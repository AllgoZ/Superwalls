import type { Session } from "@/lib/types";
import { ServiceError } from "../errors";
import { emitDataChange } from "../events";
import type { AuthRepository } from "../contracts";
import { requireClient } from "./client";

function friendlyAuthError(message: string): ServiceError {
  const text = message.toLowerCase();
  if (text.includes("invalid login")) return new ServiceError("UNAUTHENTICATED", "That email and password don't match.");
  if (text.includes("not confirmed")) {
    return new ServiceError("UNAUTHENTICATED", "Please verify your email first. We sent you a link when you signed up.");
  }
  if (text.includes("rate limit") || text.includes("too many")) {
    return new ServiceError("RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.");
  }
  if (text.includes("password")) return new ServiceError("VALIDATION", message);
  return new ServiceError("UNKNOWN", "We couldn't complete that. Please try again.");
}

async function readSession(): Promise<Session> {
  const { data } = await requireClient().auth.getSession();
  const user = data.session?.user;
  return user ? { signedIn: true, userId: user.id, email: user.email } : { signedIn: false };
}

export const supabaseAuth: AuthRepository = {
  getSession: readSession,

  async signUp({ fullName, email, password, mobile }) {
    const { data, error } = await requireClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, mobile: mobile ?? "" },
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
      },
    });
    if (error) throw friendlyAuthError(error.message);
    emitDataChange();
    // With email confirmation on (the default) there is no session until the link is opened.
    return { needsEmailVerification: !data.session };
  },

  async signIn(email, password) {
    const { error } = await requireClient().auth.signInWithPassword({ email, password });
    if (error) throw friendlyAuthError(error.message);
    emitDataChange();
    return readSession();
  },

  async signOut() {
    await requireClient().auth.signOut();
    emitDataChange();
    return { signedIn: false };
  },

  async getAccessToken() {
    const { data } = await requireClient().auth.getSession();
    return data.session?.access_token ?? null;
  },
};
