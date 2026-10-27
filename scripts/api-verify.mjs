// End-to-end acceptance tests against a RUNNING dev server (sandbox gateway enabled in .env.local).
// Usage: npm run dev   (other terminal)   npm run api:verify
// Creates temporary rows/users ("zz-api-*") and removes them afterwards.
import { createHmac, randomBytes, randomUUID } from "node:crypto";
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

let ipCounter = 1;
async function api(path, { method = "POST", body, token, headers = {}, ip, raw } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip ?? `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json, text };
}

const address = (extra = {}) => ({
  fullName: "Test Buyer",
  mobile: "9876543210",
  line1: "12 Test Street",
  area: "Test Area",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
  instructions: "",
  ...extra,
});
const checkout = (items, { email = `zz-api-${randomUUID().slice(0, 8)}@example.test`, key = `co_${randomUUID()}`, token, ip, extra } = {}) =>
  api("/api/checkout", { body: { idempotencyKey: key, email, address: address(), items, ...extra }, token, ip });
const track = (orderNumber, token, ip) => api("/api/orders/track", { body: { orderNumber, token }, ip });
const sandbox = (providerOrderId, outcome) => api("/api/payments/sandbox/complete", { body: { providerOrderId, outcome } });
const providerOrderIdOf = (r) => new URL(r.json.payment.action.url, BASE).searchParams.get("o");
const stockOf = async (id) => (await db.query("select stock, stock_reserved from products where id=$1", [id])).rows[0];
const sign = (raw) => createHmac("sha256", env.PAYMENT_SANDBOX_WEBHOOK_SECRET).update(raw).digest("hex");

async function createVerifiedUser(label) {
  const id = randomUUID();
  const email = `zz-api-${label}-${randomUUID().slice(0, 6)}@example.test`;
  const password = `Pw-${randomBytes(9).toString("base64url")}`;
  await db.query(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', $4::jsonb, now(), now(), '', '', '', '')`,
    [id, email, password, JSON.stringify({ full_name: `Tester ${label}` })],
  );
  await db.query(
    `insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
     values (gen_random_uuid(), $1::uuid, $3::text, 'email', $2::jsonb, now(), now(), now())`,
    [id, JSON.stringify({ sub: id, email, email_verified: true }), id],
  );
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const session = await response.json();
  if (!session.access_token) throw new Error(`login failed for test user: ${JSON.stringify(session).slice(0, 200)}`);
  return { id, email, token: session.access_token };
}

/** Reads through PostgREST exactly as the browser would: publishable key + the user's JWT. */
async function rest(path, token, { method = "GET", body } = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: PUBLISHABLE,
      Authorization: `Bearer ${token ?? PUBLISHABLE}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: response.status, json };
}

async function cleanup() {
  await db.query("delete from orders where customer_email like 'zz-api-%@example.test'");
  await db.query("delete from auth.users where email like 'zz-api-%@example.test'");
  await db.query("delete from rate_limits");
  await db.query("update products set stock_reserved = 0 where stock_reserved <> 0 and not exists (select 1 from inventory_reservations r where r.product_id = products.id and r.status = 'active')");
}

try {
  await cleanup();
  const startStock = await stockOf("demo-glass-cleaner");

  console.log("Browsing");
  {
    const home = await fetch(BASE + "/");
    check("storefront renders for anonymous visitors", home.status === 200);
    const anon = await rest("products?select=id,price_paise,stock&is_active=eq.true", null);
    check("guest can read the catalog (RLS)", anon.status === 200 && anon.json.length >= 6);
    const writeTry = await rest("products?id=eq.demo-glass-cleaner", null, { method: "PATCH", body: { price_paise: 1 } });
    check("guest cannot change a price", writeTry.status >= 400 || (Array.isArray(writeTry.json) && writeTry.json.length === 0));
    const price = (await db.query("select price_paise from products where id='demo-glass-cleaner'")).rows[0].price_paise;
    check("price unchanged after the attempt", Number(price) === 14900);
  }

  console.log("Guest checkout");
  let guest;
  {
    const key = `co_${randomUUID()}`;
    const email = `zz-api-guest-${randomUUID().slice(0, 6)}@example.test`;
    const r = await checkout([{ productId: "demo-glass-cleaner", quantity: 2 }], { key, email, extra: { totalPaise: 1, paymentStatus: "paid", items: undefined } });
    // (the extras above are ignored; items must be re-sent properly)
    const r2 = await checkout([{ productId: "demo-glass-cleaner", quantity: 2 }], { key, email });
    check("guest can start payment without an account", r2.status === 201 && /^SW-\d{6}-\d+$/.test(r2.json?.orderNumber), JSON.stringify(r2.json));
    guest = { ...r2.json, key, email };
    check("response includes a one-time tracking token", typeof guest.guestToken === "string" && guest.guestToken.length >= 40);
    check("payment session is a redirect to the gateway", guest.payment?.action?.kind === "redirect");
    check("server priced the order (2 x 149.00 + 49.00 delivery)", guest.totalPaise === 2 * 14900 + 4900, String(guest.totalPaise));
    void r;

    const replay = await checkout([{ productId: "demo-glass-cleaner", quantity: 2 }], { key, email });
    check("same idempotency key => same order", replay.json?.orderNumber === guest.orderNumber && replay.status === 201);
    check("replay does not re-issue the token", replay.json?.guestToken === undefined);
    const orders = (await db.query("select count(*)::int n from orders where idempotency_key=$1", [key])).rows[0].n;
    check("only one order row exists", orders === 1);

    const o = (await db.query("select order_status, payment_status, customer_type, user_id, guest_tracking_token_hash from orders where order_number=$1", [guest.orderNumber])).rows[0];
    check("stored as pending_payment / guest / no owner", o.order_status === "pending_payment" && o.payment_status === "initiated" && o.customer_type === "guest" && o.user_id === null);
    check("only a hash of the token is stored", o.guest_tracking_token_hash && o.guest_tracking_token_hash !== guest.guestToken && o.guest_tracking_token_hash.length === 64);
    const s = await stockOf("demo-glass-cleaner");
    check("stock is reserved, not yet deducted", s.stock === startStock.stock && s.stock_reserved === startStock.stock_reserved + 2, JSON.stringify(s));
  }

  console.log("Validation + tampering");
  {
    check("empty cart rejected", (await checkout([])).status === 400);
    check("quantity 0 rejected", (await checkout([{ productId: "demo-glass-cleaner", quantity: 0 }])).status === 400);
    check("bad email rejected", (await checkout([{ productId: "demo-glass-cleaner", quantity: 1 }], { email: "nope" })).status === 400);
    check("bad mobile rejected", (await api("/api/checkout", { body: { idempotencyKey: `co_${randomUUID()}`, email: "a@example.test", address: address({ mobile: "123" }), items: [{ productId: "demo-glass-cleaner", quantity: 1 }] } })).status === 400);
    check("unknown product rejected", (await checkout([{ productId: "nope", quantity: 1 }])).status === 409);
    check("over per-item limit (11 > 10) rejected", (await checkout([{ productId: "demo-dishwash-liquid", quantity: 11 }])).status === 400);
    check("quantity 99 rejected", (await checkout([{ productId: "demo-dishwash-liquid", quantity: 99 }])).status === 400);
    check("out-of-stock product rejected", (await checkout([{ productId: "demo-disinfectant-spray", quantity: 1 }])).status === 409);
    check("malformed JSON rejected", (await api("/api/checkout", { raw: "{nope" })).status === 400);
    check("invalid bearer token rejected", (await checkout([{ productId: "demo-glass-cleaner", quantity: 1 }], { token: "garbage" })).status === 401);
  }

  console.log("Guest order access");
  {
    const ok = await track(guest.orderNumber, guest.guestToken);
    check("valid token shows the order", ok.status === 200 && ok.json.order.orderNumber === guest.orderNumber);
    check("order is awaiting payment", ok.json.order.orderStatus === "pending_payment" && ok.json.order.paymentStatus === "initiated");
    check("payload has no email / token / provider data", !/email|token|hash|provider|idempotency/i.test(JSON.stringify(ok.json)));
    const other = await checkout([{ productId: "demo-microfibre-cloths", quantity: 1 }]);
    check("another guest's token cannot read this order", (await track(guest.orderNumber, other.json.guestToken)).status === 404);
    check("garbage token cannot read it", (await track(guest.orderNumber, "x".repeat(43))).status === 404);
    check("wrong token and unknown order look identical", (await track("SW-000000-9999", guest.guestToken)).status === 404);
    check("order number alone is not enough (validation)", (await api("/api/orders/track", { body: { orderNumber: guest.orderNumber } })).status === 400);
    const rl = [];
    for (let i = 0; i < 64; i++) rl.push((await track(guest.orderNumber, "y".repeat(43), "203.0.113.9")).status);
    check("guest tracking is rate limited (429)", rl.includes(429), rl.join(","));
    check("spamming wrong codes cannot lock the real owner out", (await track(guest.orderNumber, guest.guestToken, "198.51.100.7")).status === 200);
    check("customer cannot retry someone else's order", (await api("/api/orders/retry-payment", { body: { orderNumber: guest.orderNumber, token: other.json.guestToken } })).status === 404);
    check("retry without any proof is refused", (await api("/api/orders/retry-payment", { body: { orderNumber: guest.orderNumber } })).status === 404);
  }

  console.log("Payment: failure, retry, success");
  {
    const po1 = providerOrderIdOf({ json: guest });
    const failed = await sandbox(po1, "failed");
    check("failed payment webhook accepted", failed.status === 200 && failed.json.result === "failed", JSON.stringify(failed.json));
    let t = (await track(guest.orderNumber, guest.guestToken, "198.51.100.20")).json.order;
    check("failed payment: NOT paid, not placed", t.paymentStatus === "failed" && t.orderStatus === "pending_payment");
    check("failed payment released the stock hold", (await stockOf("demo-glass-cleaner")).stock_reserved === startStock.stock_reserved, JSON.stringify(await stockOf("demo-glass-cleaner")));

    const retry = await api("/api/orders/retry-payment", { body: { orderNumber: guest.orderNumber, token: guest.guestToken } });
    check("Retry Payment reuses the same order", retry.status === 200 && retry.json.orderNumber === guest.orderNumber);
    const po2 = providerOrderIdOf(retry);
    check("retry opens a NEW payment session", po2 && po2 !== po1);
    const retry2 = await api("/api/orders/retry-payment", { body: { orderNumber: guest.orderNumber, token: guest.guestToken } });
    check("double-clicking retry reuses the same live session", providerOrderIdOf(retry2) === po2);
    check("still exactly one order", (await db.query("select count(*)::int n from orders where order_number=$1", [guest.orderNumber])).rows[0].n === 1);
    check("stock re-reserved for the retry", (await stockOf("demo-glass-cleaner")).stock_reserved === startStock.stock_reserved + 2);

    // The browser cannot mark an order paid: the return URL / client callback carries no proof.
    const sneaky = await api("/api/payments/verify", { body: { provider: "sandbox", providerOrderId: po2, providerPaymentId: "pay_fake", signature: "00".repeat(32) } });
    check("forged client-side 'payment complete' is rejected", sneaky.status === 401);
    t = (await track(guest.orderNumber, guest.guestToken, "198.51.100.21")).json.order;
    check("order still unpaid after forged callback", t.paymentStatus !== "paid");

    const before = await stockOf("demo-glass-cleaner");
    const paid = await sandbox(po2, "paid");
    check("verified payment webhook accepted", paid.status === 200 && paid.json.result === "paid", JSON.stringify(paid.json));
    t = (await track(guest.orderNumber, guest.guestToken, "198.51.100.22")).json.order;
    check("verified payment => paid + placed", t.paymentStatus === "paid" && t.orderStatus === "placed");
    const after = await stockOf("demo-glass-cleaner");
    check("stock permanently deducted exactly once", after.stock === before.stock - 2 && after.stock_reserved === before.stock_reserved - 2, `${JSON.stringify(before)} -> ${JSON.stringify(after)}`);

    const again = await sandbox(po2, "paid");
    check("replaying the success is harmless (new event id)", again.status === 200 && again.json.result === "already_paid", JSON.stringify(again.json));
    const afterAgain = await stockOf("demo-glass-cleaner");
    check("no second deduction", afterAgain.stock === after.stock);

    // Exact duplicate delivery of the same signed webhook body (same event id).
    const raw = JSON.stringify({ id: `evt_${randomUUID()}`, type: "payment.captured", providerOrderId: po2, providerPaymentId: "sbx_pay_dup", amount: guest.totalPaise, currency: "INR", outcome: "paid" });
    const w1 = await api("/api/payments/webhook/sandbox", { raw, headers: { "x-sandbox-signature": sign(raw) } });
    const w2 = await api("/api/payments/webhook/sandbox", { raw, headers: { "x-sandbox-signature": sign(raw) } });
    check("duplicate webhook: first processed, second recognised", w1.status === 200 && w2.status === 200 && w2.json.result === "duplicate", `${w1.text} | ${w2.text}`);
    check("webhook with a bad signature is refused", (await api("/api/payments/webhook/sandbox", { raw, headers: { "x-sandbox-signature": "00".repeat(32) } })).status === 401);
    check("webhook with no signature is refused", (await api("/api/payments/webhook/sandbox", { raw })).status === 401);
    check("tampered webhook body is refused", (await api("/api/payments/webhook/sandbox", { raw: raw.replace('"amount":', '"amount":1'), headers: { "x-sandbox-signature": sign(raw) } })).status === 401);
    check("unknown provider webhook is refused", (await api("/api/payments/webhook/razorpay", { raw })).status === 404);
    const bad = JSON.stringify({ id: `evt_${randomUUID()}`, type: "payment.captured", providerOrderId: po2, providerPaymentId: "sbx_pay_x", amount: 100, currency: "INR", outcome: "paid" });
    const mism = await api("/api/payments/webhook/sandbox", { raw: bad, headers: { "x-sandbox-signature": sign(bad) } });
    check("signed webhook with the wrong amount cannot alter a paid order", mism.status === 200 && ["already_paid", "amount_mismatch"].includes(mism.json.result), mism.text);
    t = (await track(guest.orderNumber, guest.guestToken, "198.51.100.23")).json.order;
    check("order remains paid + placed", t.paymentStatus === "paid" && t.orderStatus === "placed");
    check("paid order cannot be paid again", (await api("/api/orders/retry-payment", { body: { orderNumber: guest.orderNumber, token: guest.guestToken } })).status === 409);
  }

  console.log("Inventory over the API");
  {
    // demo-bathroom-cleaner has 3 units.
    const stock0 = await stockOf("demo-bathroom-cleaner");
    const avail = stock0.stock - stock0.stock_reserved;
    const a = await checkout([{ productId: "demo-bathroom-cleaner", quantity: avail }]);
    check("buying everything that is available works", a.status === 201, a.text);
    const b = await checkout([{ productId: "demo-bathroom-cleaner", quantity: 1 }]);
    check("the held units cannot be bought by someone else", b.status === 409 && b.json.error.code === "OUT_OF_STOCK");
    const racers = await Promise.all(Array.from({ length: 6 }, () => checkout([{ productId: "demo-dishwash-liquid", quantity: 10 }])));
    const s = await stockOf("demo-dishwash-liquid");
    check("concurrent checkouts never exceed stock", s.stock_reserved <= s.stock && racers.filter((r) => r.status === 201).length === 6, JSON.stringify(s));
    await sandbox(providerOrderIdOf(a), "failed");
    const c = await checkout([{ productId: "demo-bathroom-cleaner", quantity: 1 }]);
    check("a failed payment frees the units for others", c.status === 201, c.text);
  }

  console.log("Registered customer");
  const userA = await createVerifiedUser("a");
  const userB = await createVerifiedUser("b");
  {
    const profile = await rest(`profiles?select=id,full_name,email,mobile`, userA.token);
    check("profile auto-created and visible to its owner", profile.status === 200 && profile.json.length === 1 && profile.json[0].email === userA.email);
    check("profile name comes from sign-up", profile.json[0].full_name === "Tester a");
    const addr = await rest("addresses", userA.token, { method: "POST", body: { user_id: userA.id, full_name: "Tester A", mobile: "9876543210", line1: "5 Saved Street", area: "Saved Area", city: "Pune", state: "Maharashtra", pincode: "411001", is_default: true } });
    check("registered user can save an address", addr.status === 201, JSON.stringify(addr.json));
    const addrs = await rest("addresses?select=line1,is_default", userA.token);
    check("saved address is returned for prefill", addrs.json.length === 1 && addrs.json[0].is_default === true);
    const asB = await rest("addresses?select=line1", userB.token);
    check("another user sees none of A's addresses", asB.json.length === 0);
    const steal = await rest("addresses", userB.token, { method: "POST", body: { user_id: userA.id, full_name: "Mallory", mobile: "9876543210", line1: "1 Evil Street", area: "Area", city: "City", state: "State", pincode: "560001" } });
    check("user cannot create an address in someone else's name", steal.status >= 400);

    const r = await checkout([{ productId: "demo-microfibre-cloths", quantity: 2 }], { token: userA.token, email: "ignored@example.test" });
    check("registered checkout works with a bearer token", r.status === 201 && r.json.guestToken === undefined, r.text);
    const row = (await db.query("select customer_type, user_id, customer_email, guest_tracking_token_hash from orders where order_number=$1", [r.json.orderNumber])).rows[0];
    check("owned by the authenticated user, no guest token", row.customer_type === "registered" && row.user_id === userA.id && row.guest_tracking_token_hash === null);
    check("contact email comes from the account, not the request", row.customer_email === userA.email.toLowerCase());
    check("the client cannot claim a different owner", (await checkout([{ productId: "demo-microfibre-cloths", quantity: 1 }], { token: userA.token, extra: { userId: userB.id, user_id: userB.id } })).status === 201
      && (await db.query("select count(*)::int n from orders where user_id=$1", [userB.id])).rows[0].n === 0);

    const own = await rest("orders?select=order_number,order_status,payment_status,order_items(name,quantity)&order=created_at.desc", userA.token);
    check("registered user sees own order history (RLS)", own.status === 200 && own.json.some((o) => o.order_number === r.json.orderNumber));
    const others = await rest("orders?select=order_number", userB.token);
    check("other user sees none of it", others.json.length === 0);
    const guestRead = await rest("orders?select=order_number&customer_type=eq.guest", userA.token);
    check("registered users cannot read guest orders", guestRead.json.length === 0);
    const anonRead = await rest("orders?select=order_number", null);
    check("anonymous cannot read orders", anonRead.status >= 400 || anonRead.json.length === 0);

    const upd = await rest(`orders?order_number=eq.${r.json.orderNumber}`, userA.token, { method: "PATCH", body: { payment_status: "paid", order_status: "delivered" } });
    check("customer cannot mark an order paid / delivered", upd.status >= 400);
    const st = (await db.query("select payment_status, order_status from orders where order_number=$1", [r.json.orderNumber])).rows[0];
    check("order status unchanged after the attempt", st.payment_status !== "paid" && st.order_status === "pending_payment");
    const del = await rest(`orders?order_number=eq.${r.json.orderNumber}`, userA.token, { method: "DELETE" });
    check("customer cannot delete an order", del.status >= 400 || (await db.query("select 1 from orders where order_number=$1", [r.json.orderNumber])).rowCount === 1);
    const pay = await rest("payments?select=*", userA.token);
    check("customer cannot read payment records", pay.status >= 400);
    const tokcol = await rest("orders?select=guest_tracking_token_hash", userA.token);
    check("token hash column is not readable", tokcol.status >= 400);
    const rpc = await rest("rpc/finalize_payment", userA.token, { method: "POST", body: { p_provider: "x" } });
    check("server functions are not callable from the browser", rpc.status >= 400);
    const stockWrite = await rest("products?id=eq.demo-glass-cleaner", userA.token, { method: "PATCH", body: { stock: 99999 } });
    check("customer cannot edit stock", stockWrite.status >= 400);

    check("registered retry works for the owner", (await api("/api/orders/retry-payment", { body: { orderNumber: r.json.orderNumber }, token: userA.token })).status === 200);
    check("another registered user cannot retry it", (await api("/api/orders/retry-payment", { body: { orderNumber: r.json.orderNumber }, token: userB.token })).status === 404);
    const po = providerOrderIdOf(await api("/api/orders/retry-payment", { body: { orderNumber: r.json.orderNumber }, token: userA.token }));
    check("registered payment verified => order visible as paid to its owner", (await sandbox(po, "paid")).json.result === "paid"
      && (await rest(`orders?select=order_status,payment_status&order_number=eq.${r.json.orderNumber}`, userA.token)).json[0].payment_status === "paid");
  }

  console.log("Claiming guest orders");
  {
    const gEmail = userA.email;
    const g1 = await checkout([{ productId: "demo-microfibre-cloths", quantity: 1 }], { email: gEmail });
    const g2 = await checkout([{ productId: "demo-microfibre-cloths", quantity: 1 }], { email: "zz-api-stranger@example.test" });
    check("claim requires authentication", (await api("/api/orders/claim", { body: { tokens: [] } })).status === 401);
    const none = await api("/api/orders/claim", { body: { tokens: [] }, token: userB.token });
    check("a user whose email doesn't match claims nothing without a token", none.status === 200 && none.json.claimed === 0);
    const wrong = await api("/api/orders/claim", { body: { tokens: ["z".repeat(43)] }, token: userB.token });
    check("a guessed token claims nothing", wrong.json.claimed === 0);
    check("order is still a guest order", (await db.query("select customer_type from orders where order_number=$1", [g2.json.orderNumber])).rows[0].customer_type === "guest");
    const byToken = await api("/api/orders/claim", { body: { tokens: [g2.json.guestToken] }, token: userB.token });
    check("holding the secret token proves ownership", byToken.json.claimed === 1);
    check("claimed order now belongs to that account", (await db.query("select user_id from orders where order_number=$1", [g2.json.orderNumber])).rows[0].user_id === userB.id);
    check("its old tracking token is dead", (await track(g2.json.orderNumber, g2.json.guestToken)).status === 404);
    const byEmail = await api("/api/orders/claim", { body: { tokens: [] }, token: userA.token });
    check("a VERIFIED matching email claims that email's guest order", byEmail.json.claimed >= 1);
    check("…and it is the right one", (await db.query("select user_id from orders where order_number=$1", [g1.json.orderNumber])).rows[0].user_id === userA.id);
    check("claim is idempotent", (await api("/api/orders/claim", { body: { tokens: [] }, token: userA.token })).json.claimed === 0);
  }

  console.log("Operations");
  {
    check("cron route is closed without the secret", (await api("/api/cron/expire-reservations", { method: "GET" })).status === 401);
    check("cron route works with the secret", (await api("/api/cron/expire-reservations", { method: "GET", headers: { Authorization: `Bearer ${env.CRON_SECRET}` } })).status === 200);
    check("sandbox session lookup 404s for unknown sessions", (await api("/api/payments/sandbox/session?o=x", { method: "GET" })).status === 404);
    const res = await fetch(BASE + "/api/checkout", { method: "GET" });
    check("checkout endpoint is POST-only", res.status === 405);
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
