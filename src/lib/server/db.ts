import "server-only";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { ApiError, mapDatabaseError } from "./errors";
import { SUPABASE_ROOT_CA } from "./supabase-ca";

/**
 * The server's privileged database access.
 *
 * Orders, payments and stock are changed ONLY by SECURITY DEFINER SQL functions that are not
 * callable from browsers (see supabase/migrations/0002 and 0003). This pool is the only caller.
 * `SUPABASE_DB_URL` is a server-only secret: it is never prefixed NEXT_PUBLIC_ and never sent to the client.
 */
// Timestamps leave this module as ISO strings, the same shape the JSON API and React props carry, never as Date objects.
types.setTypeParser(types.builtins.TIMESTAMPTZ, (value) => new Date(value).toISOString());
types.setTypeParser(types.builtins.TIMESTAMP, (value) => new Date(`${value}Z`).toISOString());

const globalForPool = globalThis as unknown as { __swPool?: Pool };

function createPool(): Pool {
  const raw = process.env.SUPABASE_DB_URL;
  if (!raw) {
    throw new ApiError("BACKEND_NOT_CONFIGURED", "The store backend is not configured yet.");
  }
  const url = new URL(raw);
  const pool = new Pool({
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.slice(1) || "postgres",
    ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (error) => console.error("[db] idle client error:", error.message));
  return pool;
}

export function isBackendConfigured(): boolean {
  return Boolean(process.env.SUPABASE_DB_URL);
}

export function getPool(): Pool {
  // Cached on globalThis so dev hot reloads do not leak connections.
  globalForPool.__swPool ??= createPool();
  return globalForPool.__swPool;
}

/** Runs a parameterised query; database exceptions from our functions are mapped to ApiErrors. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  try {
    const result = await getPool().query<T>(text, params);
    return result.rows;
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  return (await query<T>(text, params))[0] ?? null;
}

export interface Tx {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
  queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T | null>;
}

/** Runs `fn` in one transaction: committed if it returns, rolled back if it throws. Database errors are mapped to ApiErrors. */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let client: PoolClient;
  try {
    client = await getPool().connect();
  } catch (error) {
    throw mapDatabaseError(error);
  }
  const tx: Tx = {
    async query(text, params = []) {
      return (await client.query(text, params)).rows;
    },
    async queryOne(text, params = []) {
      return (await client.query(text, params)).rows[0] ?? null;
    },
  };
  try {
    await client.query("begin");
    const result = await fn(tx);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw mapDatabaseError(error);
  } finally {
    client.release();
  }
}
