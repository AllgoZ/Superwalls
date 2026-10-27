import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Guest order access tokens: 256 bits from the OS CSPRNG, shown to the customer once.
 * Only the SHA-256 hash is stored, so a database leak does not reveal usable tokens. The token
 * is high-entropy, so a fast hash is appropriate (no brute-force surface, unlike passwords).
 */
export function generateGuestToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
