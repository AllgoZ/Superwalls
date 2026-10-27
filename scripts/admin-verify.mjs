// End-to-end acceptance tests for the admin CMS against a RUNNING dev server (`npm run dev`).
// Covers authentication, authorization per role, direct unauthorized requests, and each admin module's
// operations. Creates temporary rows/users ("zz-adm-*") and removes them afterwards.
// Usage: npm run dev   (other terminal)   npm run admin:verify
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { loadEnvLocal, pgConfig } from "./db-url.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const env = loadEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const db = new pg.Client(pgConfig());
await db.connect();

let passed = 0;
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name} ${detail}`);
  }
};
const section = (title) => console.log(title);

let ipCounter = 1;
const nextIp = () => `10.9.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

/** A tiny cookie jar: the admin session is httpOnly cookies, exactly as a browser would hold them. */
function jarFrom(response, jar = {}) {
  for (const line of response.headers.getSetCookie?.() ?? []) {
    const [pair, ...attrs] = line.split(";");
    const [name, ...rest] = pair.split("=");
    const value = rest.join("=");
    if (/max-age=0|expires=thu, 01 jan 1970/i.test(attrs.join(";")) || value === "") delete jar[name.trim()];
    else jar[name.trim()] = value;
  }
  return jar;
}
const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

async function raw(path, { method = "GET", body, jar, headers = {}, origin = BASE, ip, redirect = "manual" } = {}) {
  const response = await fetch(BASE + path, {
    method,
    redirect,
    headers: {
      "x-forwarded-for": ip ?? nextIp(),
      ...(method !== "GET" && origin ? { Origin: origin } : {}),
      ...(body !== undefined && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(jar ? { Cookie: cookieHeader(jar) } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json, text, headers: response.headers, response };
}

const call = (session, op, input = {}, extra = {}) => raw(`/api/admin/op/${op}`, { method: "POST", body: input, jar: session?.jar, ...extra });

async function createUser(label, { confirmed = true } = {}) {
  const id = randomUUID();
  const email = `zz-adm-${label}-${randomUUID().slice(0, 6)}@example.test`;
  const password = `Pw-${randomBytes(9).toString("base64url")}`;
  await db.query(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf')), $5,
       '{"provider":"email","providers":["email"]}', $4::jsonb, now(), now(), '', '', '', '')`,
    [id, email, password, JSON.stringify({ full_name: `Tester ${label}` }), confirmed ? new Date().toISOString() : null],
  );
  await db.query(
    `insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
     values (gen_random_uuid(), $1::uuid, $3::text, 'email', $2::jsonb, now(), now(), now())`,
    [id, JSON.stringify({ sub: id, email, email_verified: confirmed }), id],
  );
  return { id, email, password };
}

async function signIn(user) {
  const res = await raw("/api/admin/auth/login", { method: "POST", body: { email: user.email, password: user.password } });
  return { ...user, res, jar: jarFrom(res.response) };
}

/** A staff member with a live admin session. */
async function createStaff(role, label = role) {
  const user = await createUser(label);
  await db.query(
    "insert into admin_members (user_id, email, display_name, role, status, activated_at) values ($1, $2, $3, $4, 'active', now())",
    [user.id, user.email, `Staff ${label}`, role],
  );
  const session = await signIn(user);
  if (session.res.status !== 200) throw new Error(`staff login failed for ${role}: ${session.res.text.slice(0, 200)}`);
  return session;
}

async function cleanup() {
  // The guard that protects the last super admin must be lifted while test staff are removed, then restored.
  // Test data created by the module sections below. Orders first: products are referenced by order items.
  await db.query("delete from orders where customer_email like 'zz-adm-%@example.test'");
  await db.query("delete from products where id like 'zz-adm-%'");
  await db.query("delete from categories where slug like 'zz-adm-%'");
  await db.query("begin");
  try {
    await db.query("alter table public.admin_members disable trigger admin_members_guard");
    await db.query("delete from admin_members where email like 'zz-adm-%@example.test'");
    await db.query("delete from auth.users where email like 'zz-adm-%@example.test'");
    await db.query("alter table public.admin_members enable trigger admin_members_guard");
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
  await db.query("delete from rate_limits");
}

// Pages stream behind Suspense, so a server-side redirect arrives inside the HTML instead of as a 3xx.
const pageDenied = (r) => (r.status >= 300 && r.status < 400) || (r.status === 200 && /NEXT_REDIRECT/.test(r.text) && /no-access|admin\/login/.test(r.text));

const ctx = { pageDenied, createStaff, createUser, signIn, call, raw, db, check, section, BASE, env, SUPABASE_URL, PUBLISHABLE, jarFrom, cookieHeader };

try {
  await cleanup();

  // ------------------------------------------------------------------ authentication
  section("Admin authentication");
  {
    const anon = await raw("/admin");
    check("anonymous /admin redirects to the login page", anon.status >= 300 && anon.status < 400 && (anon.headers.get("location") ?? "").includes("/admin/login"));
    const anonDeep = await raw("/admin/orders?status=placed");
    check("anonymous deep link keeps a safe ?next", (anonDeep.headers.get("location") ?? "").includes("next=%2Fadmin%2Forders"));
    check("login page renders without a session", (await raw("/admin/login")).status === 200);
    check("anonymous mutation is 401", (await call(null, "team.invite", {})).status === 401);
    check("unknown op without a session is still 401 (no op enumeration)", (await call(null, "nope.nothing", {})).status === 401);

    const customer = await createUser("customer");
    const asCustomer = await signIn(customer);
    check("a valid customer account cannot sign in to admin", asCustomer.res.status === 401);
    check("…and receives no session cookie", Object.keys(asCustomer.jar).length === 0);
    check("…and the error does not reveal why", /no admin access/i.test(asCustomer.res.json?.error?.message ?? ""));

    const wrongPw = await raw("/api/admin/auth/login", { method: "POST", body: { email: customer.email, password: "definitely-wrong" } });
    check("wrong password is 401", wrongPw.status === 401);

    const noOrigin = await raw("/api/admin/auth/login", { method: "POST", body: { email: customer.email, password: customer.password }, origin: null });
    check("login without an Origin header is refused", noOrigin.status === 403);
    const evil = await raw("/api/admin/auth/login", { method: "POST", body: { email: customer.email, password: customer.password }, origin: "https://evil.example" });
    check("login from a foreign Origin is refused", evil.status === 403);

    const sa = await createStaff("super_admin", "sa");
    const cookies = sa.res.response.headers.getSetCookie();
    check("super admin signs in", sa.res.status === 200);
    check("session cookies are httpOnly and SameSite", cookies.length >= 2 && cookies.every((c) => /httponly/i.test(c) && /samesite=lax/i.test(c)));
    check("session is not readable from the body", !JSON.stringify(sa.res.json).includes("eyJ"));
    const page = await raw("/admin", { jar: sa.jar });
    check("admin dashboard renders for a signed-in admin", page.status === 200 && /Welcome|Dashboard/i.test(page.text));
    check("admin pages are never cached", /no-store/.test(page.headers.get("cache-control") ?? ""));
    check("admin pages are noindex", /noindex/i.test(page.headers.get("x-robots-tag") ?? ""));
    const loginAgain = await raw("/admin/login", { jar: sa.jar });
    // The page streams, so Next delivers this redirect inside the HTML rather than as a 3xx.
    check("an already signed-in admin skips the login form", (loginAgain.status >= 300 && loginAgain.status < 400) || /NEXT_REDIRECT/.test(loginAgain.text));

    const tamper = { ...sa.jar, sw_admin_at: sa.jar.sw_admin_at.slice(0, -4) + "AAAA" };
    check("a tampered access token is rejected", (await call({ jar: { sw_admin_at: tamper.sw_admin_at } }, "team.invite", {})).status === 401);

    const logs = await db.query("select action from admin_activity_logs where actor_id = $1", [sa.id]);
    check("sign-in is written to the audit log", logs.rows.some((r) => r.action === "admin.login"));

    ctx.sa = sa;
    ctx.customer = customer;
    ctx.asCustomer = asCustomer;
  }

  // ----------------------------------------------------------------- authorization
  section("Roles and team management");
  {
    const { sa } = ctx;
    const manager = await createStaff("manager", "mgr");
    const orderMgr = await createStaff("order_manager", "om");
    const contentMgr = await createStaff("content_manager", "cm");
    const invMgr = await createStaff("inventory_manager", "im");
    Object.assign(ctx, { manager, orderMgr, contentMgr, invMgr });

    const invite = (email) => ({ email, displayName: "Newbie", role: "manager" });
    for (const [label, s] of [["manager", manager], ["order manager", orderMgr], ["content manager", contentMgr], ["inventory manager", invMgr]]) {
      check(`${label} cannot invite admins`, (await call(s, "team.invite", invite(`zz-adm-x-${randomUUID().slice(0, 6)}@example.test`))).status === 403);
    }
    check("manager cannot open the team page (redirected, not rendered)", pageDenied(await raw("/admin/settings/team", { jar: manager.jar })));

    const nav = await raw("/admin", { jar: orderMgr.jar });
    check("order manager's sidebar has Orders but not Team/Settings", /Orders/.test(nav.text) && !/Team/.test(nav.text) && !/Activity log/.test(nav.text));
    const navM = await raw("/admin", { jar: manager.jar });
    check("manager's sidebar has no Team / Settings / Activity log", !/>Team</.test(navM.text) && !/>Activity log</.test(navM.text));

    // Invitations are unsafe when the project auto-confirms emails, so the op must say so.
    const settings = await (await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: PUBLISHABLE } })).json();
    const autoconfirm = settings.mailer_autoconfirm !== false;
    const target = await createUser("invitee");
    const inv = await call(sa, "team.invite", invite(target.email));
    if (autoconfirm) {
      check("invitations are refused while Supabase auto-confirms emails", inv.status === 409);
    } else {
      check("super admin can invite an existing verified account", inv.status === 200 && inv.json?.data?.status === "active");
    }

    // Self-service escalation and lockout protections (DB level, independent of the app).
    const self = await db.query("select id from admin_members where user_id = $1", [sa.id]);
    const selfDemote = await call(sa, "team.update", { memberId: self.rows[0].id, role: "manager" });
    check("nobody can change their own role", selfDemote.status === 409);
    const mgrRow = await db.query("select id from admin_members where user_id = $1", [manager.id]);
    check("manager cannot promote themselves", (await call(manager, "team.update", { memberId: mgrRow.rows[0].id, role: "super_admin" })).status === 403);
    const promote = await call(sa, "team.update", { memberId: mgrRow.rows[0].id, role: "order_manager" });
    check("super admin can change another member's role", promote.status === 200 && promote.json?.data?.role === "order_manager");
    await call(sa, "team.update", { memberId: mgrRow.rows[0].id, role: "manager" });

    let blocked = false;
    try {
      await db.query("update admin_members set status = 'suspended' where user_id = $1", [sa.id]);
    } catch (e) {
      blocked = /LAST_SUPER_ADMIN/.test(e.message);
    }
    check("the last active super admin cannot be suspended", blocked);

    const suspend = await call(sa, "team.update", { memberId: mgrRow.rows[0].id, status: "suspended" });
    check("super admin can suspend a member", suspend.status === 200);
    check("a suspended member's existing session stops working at once", (await call(manager, "team.invite", invite("a@example.test"))).status === 401);
    const relogin = await signIn(manager);
    check("a suspended member cannot sign in again", relogin.res.status === 403);
    await call(sa, "team.update", { memberId: mgrRow.rows[0].id, status: "active" });
    ctx.manager = await signIn(manager);

    // Audit log protection.
    let immutable = false;
    try {
      await db.query("update admin_activity_logs set summary = 'tampered' where actor_id = $1", [sa.id]);
    } catch (e) {
      immutable = /AUDIT_LOG_IMMUTABLE/.test(e.message);
    }
    check("audit log rows cannot be edited", immutable);
    let undeletable = false;
    try {
      await db.query("delete from admin_activity_logs where actor_id = $1", [sa.id]);
    } catch (e) {
      undeletable = /AUDIT_LOG_IMMUTABLE/.test(e.message);
    }
    check("audit log rows cannot be deleted", undeletable);

    // Customers (and anonymous visitors) can reach none of the admin tables through the public API.
    const customerSession = await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" },
      body: JSON.stringify({ email: ctx.customer.email, password: ctx.customer.password }),
    })).json();
    for (const table of ["admin_members", "admin_role_permissions", "admin_activity_logs"]) {
      const anon = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: { apikey: PUBLISHABLE } });
      const asUser = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${customerSession.access_token}` } });
      check(`${table} is closed to anonymous visitors`, anon.status === 401 || anon.status === 403 || ((await anon.clone().json()).length ?? 0) === 0);
      check(`${table} is closed to signed-in customers`, asUser.status === 401 || asUser.status === 403 || ((await asUser.clone().json()).length ?? 0) === 0);
    }
    const selfInsert = await fetch(`${SUPABASE_URL}/rest/v1/admin_members`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${customerSession.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: ctx.customer.id, email: ctx.customer.email, role: "super_admin", status: "active" }),
    });
    check("a customer cannot grant themselves admin through the public API", !selfInsert.ok);
    const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_invite_member`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${customerSession.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_actor: ctx.sa.id, p_email: "x@example.test", p_role: "super_admin", p_name: "", p_trust_verified: true }),
    });
    check("admin SQL functions are not callable through the public API", !rpc.ok);
  }

  // Later stages append their sections here (see the bottom of each module's stage).
  globalThis.__adminVerify = ctx;
  const extras = ["./admin-verify.catalog.mjs", "./admin-verify.orders.mjs", "./admin-verify.inventory.mjs", "./admin-verify.cms.mjs", "./admin-verify.settings.mjs"];
  // ONLY=inventory,cms re-runs just those modules (the authentication and role section above always runs).
  const only = process.env.ONLY?.split(",").map((name) => name.trim()).filter(Boolean);
  for (const file of extras) {
    if (only && !only.some((name) => file.includes(`.${name}.`))) continue;
    try {
      await import(file);
    } catch (error) {
      if (error?.code === "ERR_MODULE_NOT_FOUND" && String(error.message).includes(file.replace("./", ""))) continue;
      throw error;
    }
  }
} catch (error) {
  failures.push("unexpected error");
  console.error(error);
} finally {
  await cleanup().catch((e) => console.error("cleanup failed:", e.message));
  await db.end();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("Failures:\n - " + failures.join("\n - "));
  process.exit(1);
}
