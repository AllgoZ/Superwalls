// Applies supabase/migrations/*.sql in order, each in its own transaction. Migrations are idempotent.
// Usage: npm run db:migrate   (reads SUPABASE_DB_URL_RAW / SUPABASE_DB_POOLER_HOST from .env.local)
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { pgConfig } from "./db-url.mjs";

const dir = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client(pgConfig());
await client.connect();
try {
  for (const file of files) {
    process.stdout.write(`apply ${file} ... `);
    await client.query("begin");
    try {
      await client.query(readFileSync(dir + file, "utf8"));
      await client.query("commit");
      console.log("ok");
    } catch (error) {
      await client.query("rollback");
      console.log("FAILED");
      throw error;
    }
  }
} finally {
  await client.end();
}
