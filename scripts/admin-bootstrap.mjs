// Provisions the FIRST super admin. There is no public admin sign-up, so this is the controlled entry point.
// It needs the same database access as `npm run db:migrate` (SUPABASE_DB_URL in .env.local) and nothing else:
// no admin email, password or secret is stored in the source code.
//
//   1. Create the person's normal account at /signup and confirm the email (Supabase sends the link).
//   2. npm run admin:bootstrap -- --email you@example.com --name "Your Name"
//   3. Sign in at /admin/login with that same account.
//
// If the account does not exist yet, an invitation is stored instead; it activates the first time the person
// signs in with that email AFTER Supabase has verified it. Refuses to run when a super admin already exists
// (use /admin/settings/team after that), unless --force is given.
import pg from "pg";
import { pgConfig } from "./db-url.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const email = flag("email")?.trim().toLowerCase();
const name = flag("name")?.trim() ?? "";
const force = args.includes("--force");

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: npm run admin:bootstrap -- --email you@example.com [--name "Your Name"] [--force]');
  process.exit(1);
}

const client = new pg.Client(pgConfig());
await client.connect();
try {
  await client.query("begin");
  const { rows: existing } = await client.query("select email from public.admin_members where role = 'super_admin' and status = 'active'");
  if (existing.length > 0 && !force) {
    console.error(`A super admin already exists (${existing.map((row) => row.email).join(", ")}). Add more staff from /admin/settings/team, or re-run with --force.`);
    process.exitCode = 1;
    await client.query("rollback");
  } else {
    const { rows: users } = await client.query("select id, email_confirmed_at from auth.users where lower(email) = $1 limit 1", [email]);
    const user = users[0];
    await client.query("delete from public.admin_members where lower(email) = $1 and status in ('invited', 'revoked')", [email]);
    if (user) {
      await client.query(
        `insert into public.admin_members (user_id, email, display_name, role, status, activated_at)
         values ($1, $2, $3, 'super_admin', 'active', now())
         on conflict (user_id) do update set role = 'super_admin', status = 'active', activated_at = coalesce(admin_members.activated_at, now())`,
        [user.id, email, name],
      );
      console.log(`Done: ${email} is now an active super admin. Sign in at /admin/login.`);
      if (!user.email_confirmed_at) console.log("Note: this account's email is not confirmed yet; confirm it before relying on it.");
    } else {
      await client.query(
        `insert into public.admin_members (email, display_name, role, status, invite_expires_at)
         values ($1, $2, 'super_admin', 'invited', now() + interval '30 days')`,
        [email, name],
      );
      console.log(`No account exists for ${email} yet. An invitation was stored (valid 30 days).`);
      console.log("Create the account at /signup, confirm the email, then sign in at /admin/login to activate it.");
    }
    await client.query("commit");
  }
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  console.error("Failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
