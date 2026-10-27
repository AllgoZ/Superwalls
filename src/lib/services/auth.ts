import type { Session, SignUpInput } from "@/lib/types";
import { repositories } from "./repositories";

export function getSession(): Promise<Session> {
  return repositories.auth.getSession();
}

export function signUp(input: SignUpInput): Promise<{ needsEmailVerification: boolean }> {
  return repositories.auth.signUp(input);
}

export function signIn(email: string, password: string): Promise<Session> {
  return repositories.auth.signIn(email, password);
}

export function signOut(): Promise<Session> {
  return repositories.auth.signOut();
}
