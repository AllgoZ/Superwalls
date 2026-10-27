import "server-only";
import { revalidateTag } from "next/cache";
import type { z } from "zod";
import type { Permission } from "@/lib/admin/permissions";
import { ApiError } from "../errors";
import { clientIp, enforceRateLimit, json } from "../http";
import type { AuditEntry } from "./audit";
import { writeAudit } from "./audit";
import { requireAdminApi, type AdminContext } from "./session";

export interface OpContext {
  admin: AdminContext;
  request: Request;
}

export interface OpDefinition<S extends z.ZodType, R> {
  /** `area.verb`, e.g. `products.save`. This is the URL segment of `POST /api/admin/op/<name>`. */
  name: string;
  permission: Permission;
  input: S;
  /** Hard cap on the request body. Large rich-text ops raise it explicitly. */
  maxBytes?: number;
  run: (ctx: OpContext, input: z.infer<S>) => Promise<R>;
  audit?: (input: z.infer<S>, result: R, ctx: OpContext) => AuditEntry | AuditEntry[] | null;
  /** Cache tags to expire so the storefront never serves stale content after this op. */
  revalidate?: string[] | ((input: z.infer<S>, result: R) => string[]);
}

export interface RegisteredOp {
  name: string;
  permission: Permission;
  maxBytes: number;
  execute: (ctx: OpContext, body: unknown) => Promise<{ data: unknown; audit: AuditEntry[]; tags: string[] }>;
}

/** Binds a typed operation (schema + handler) into an untyped registry entry. */
export function defineOp<S extends z.ZodType, R>(def: OpDefinition<S, R>): RegisteredOp {
  return {
    name: def.name,
    permission: def.permission,
    maxBytes: def.maxBytes ?? 64_000,
    async execute(ctx, body) {
      const parsed = def.input.safeParse(body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
        throw new ApiError("VALIDATION", `${where}${issue?.message ?? "Invalid request."}`);
      }
      const result = await def.run(ctx, parsed.data);
      const audit = def.audit?.(parsed.data, result, ctx) ?? [];
      const tags = typeof def.revalidate === "function" ? def.revalidate(parsed.data, result) : (def.revalidate ?? []);
      return { data: result, audit: Array.isArray(audit) ? audit : [audit], tags };
    },
  };
}

/** Mutating requests must come from our own pages. SameSite=Lax cookies are the first line; this is the second. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new ApiError("FORBIDDEN", "Missing Origin header.");
  const allowed = new Set<string>([new URL(request.url).origin]);
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (configured) allowed.add(configured);
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) allowed.add(`${request.headers.get("x-forwarded-proto") ?? "https"}://${forwardedHost}`);
  if (!allowed.has(origin)) throw new ApiError("FORBIDDEN", "Cross-site request refused.");
}

/** The single entry point for admin mutations: origin -> session -> permission -> rate limit -> validate -> run -> audit -> revalidate. */
export async function runAdminOp(request: Request, registry: Map<string, RegisteredOp>, name: string): Promise<Response> {
  assertSameOrigin(request);
  const admin = await requireAdminApi();
  const op = registry.get(name);
  if (!op) throw new ApiError("NOT_FOUND", "Unknown operation.");
  // Re-check on every call: the permission set was just read from the database, never from the browser.
  await requireAdminApi(op.permission);
  await enforceRateLimit("admin-op", admin.userId, 240, 60);

  const text = await request.text();
  if (text.length > op.maxBytes) throw new ApiError("VALIDATION", "Request is too large.");
  let body: unknown = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError("VALIDATION", "Request body must be JSON.");
    }
  }

  const ctx: OpContext = { admin, request };
  const result = await op.execute(ctx, body);

  for (const tag of result.tags) revalidateTag(tag, { expire: 0 });
  const ip = clientIp(request);
  for (const entry of result.audit) await writeAudit(admin, entry, ip);

  return json({ data: result.data ?? null });
}
