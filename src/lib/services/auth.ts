import type { Session } from "@/lib/types";
import { repositories } from "./repositories";

export function getSession(): Promise<Session> {
  return repositories.auth.getSession();
}

export function signIn(): Promise<Session> {
  return repositories.auth.signIn();
}

export function signOut(): Promise<Session> {
  return repositories.auth.signOut();
}
