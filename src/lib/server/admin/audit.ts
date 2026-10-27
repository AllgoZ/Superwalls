import "server-only";
import { query } from "../db";

export interface AuditEntry {
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  /** Before/after values or other context. Secrets are stripped by `redact` before storage. */
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|api[-_]?key|otp|cvv|card|signature/i;
const MAX_STRING = 500;

/** Removes anything that looks like a credential and bounds the size, so logs never become a secret store. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value !== "object") return value;
  if (depth >= 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(inner, depth + 1);
  }
  return out;
}

/** Appends to the immutable audit log. A logging failure is reported but never undoes the action that succeeded. */
export async function writeAudit(
  actor: { userId: string; email: string } | null,
  entry: AuditEntry,
  ip?: string,
): Promise<void> {
  try {
    await query("select public.log_admin_activity($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::jsonb, $8::text)", [
      actor?.userId ?? null,
      actor?.email ?? null,
      entry.action,
      entry.entityType ?? null,
      entry.entityId ?? null,
      entry.summary,
      JSON.stringify(redact(entry.metadata ?? {})),
      ip ?? null,
    ]);
  } catch (error) {
    console.error("[audit] failed to write log entry:", entry.action, error instanceof Error ? error.message : error);
  }
}
