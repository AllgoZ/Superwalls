// Builds a node-postgres config from SUPABASE_DB_URL in .env.local (or the environment).
// TLS is verified against Supabase's root CA, which Node does not trust by default.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function loadEnvLocal(path = ".env.local") {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

export function pgConfig(env = loadEnvLocal()) {
  const raw = process.env.SUPABASE_DB_URL || env.SUPABASE_DB_URL;
  if (!raw) throw new Error("SUPABASE_DB_URL is not set (.env.local)");
  const url = new URL(raw);
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.slice(1) || "postgres",
    ssl: {
      ca: readFileSync(fileURLToPath(new URL("../supabase/certs/supabase-prod-ca-2021.crt", import.meta.url))),
      rejectUnauthorized: true,
    },
  };
}
