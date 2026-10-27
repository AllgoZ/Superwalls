// Database-level acceptance tests: inventory, idempotency, payment finalisation, guest isolation, RLS.
// Creates temporary rows (products "zz-test-*", auth users "zz-test-*@example.test") and removes them.
// Usage: npm run db:verify
import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { pgConfig } from "./db-url.mjs";

const cfg = pgConfig();
const newClient = async () => {
  const c = new pg.Client(cfg);
  await c.connect();
  return c;
};

let passed = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name} ${detail}`);
  }
}
const sha = (s) => createHash("sha256").update(s).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const items = (arr) => JSON.stringify(arr.map(([productId, quantity]) => ({ productId, quantity })));
const addr = JSON.stringify({ fullName: "T", mobile: "9876543210", line1: "1 Test Street", area: "A", city: "C", state: "S", pincode: "560001" });

async function createOrder(c, { key = `k-${randomUUID()}`, userId = null, email = "guest@example.test", cart, subtotal, tokenHash, minutes = 30 }) {
  const t = userId ? null : (tokenHash ?? sha(token()));
  const { rows } = await c.query(
    "select public.create_checkout_order($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13) as r",
    [key, userId, "Test", email, "9876543210", addr, items(cart), subtotal, 0, 0, t, minutes, 10],
  );
  return { ...rows[0].r, key, tokenHash: t };
}
const product = async (c, id) => (await c.query("select stock, stock_reserved from products where id=$1", [id])).rows[0];
const order = async (c, id) => (await c.query("select order_status, payment_status, user_id, customer_type from orders where id=$1", [id])).rows[0];
async function attempt(c, orderId) {
  const { rows } = await c.query("select public.begin_payment_attempt($1,'testpay',30) as r", [orderId]);
  return rows[0].r;
}
async function finalize(c, { event = `evt-${randomUUID()}`, pOrder, payment = `pay_${randomUUID()}`, amount, outcome = "paid" }) {
  const { rows } = await c.query(
    "select public.finalize_payment('testpay',$1,'test',$2,$3,$4,'INR',$5,'test','{}'::jsonb) as r",
    [event, pOrder, payment, amount, outcome],
  );
  return rows[0].r;
}
async function expectError(promise, pattern) {
  try {
    await promise;
    return false;
  } catch (e) {
    return pattern.test(e.message);
  }
}

const admin = await newClient();
const created = { products: ["zz-test-a", "zz-test-b", "zz-test-c"], users: [] };

async function cleanup() {
  await admin.query("delete from orders where customer_email like '%@example.test'");
  await admin.query("delete from products where id like 'zz-test-%'");
  await admin.query("delete from auth.users where email like 'zz-test-%@example.test'");
  await admin.query("delete from rate_limits where key like 'zz-test-%'");
}

try {
  await cleanup();
  await admin.query(`insert into products (id,name,price_paise,stock,images) values
    ('zz-test-a','Test A',10000,5,'[{"src":"/x.svg"}]'),
    ('zz-test-b','Test B',20000,10,'[]'),
    ('zz-test-c','Test C',5000,1,'[]')`);

  console.log("Inventory");
  {
    // 12 buyers race for 5 units: exactly 5 may win.
    const clients = await Promise.all(Array.from({ length: 12 }, newClient));
    const results = await Promise.allSettled(clients.map((c) => createOrder(c, { cart: [["zz-test-a", 1]], subtotal: 10000 })));
    await Promise.all(clients.map((c) => c.end()));
    const won = results.filter((r) => r.status === "fulfilled").length;
    const lost = results.filter((r) => r.status === "rejected" && /OUT_OF_STOCK/.test(r.reason.message)).length;
    const p = await product(admin, "zz-test-a");
    check("12 concurrent buyers, 5 in stock => exactly 5 orders", won === 5 && lost === 7, `won=${won} lost=${lost}`);
    check("reserved never exceeds stock", p.stock_reserved === 5 && p.stock === 5, JSON.stringify(p));
    check("DB constraint blocks forced oversell", await expectError(
      admin.query("update products set stock_reserved = stock + 1 where id='zz-test-a'"), /products_reserved_le_stock/));
  }
  await admin.query("delete from orders where customer_email like '%@example.test'");
  await admin.query("update products set stock=5, stock_reserved=0 where id='zz-test-a'");

  console.log("Order creation");
  const A = await createOrder(admin, { cart: [["zz-test-a", 2], ["zz-test-b", 1]], subtotal: 40000 });
  {
    check("order created pending_payment", (await order(admin, A.orderId)).order_status === "pending_payment");
    const again = await createOrder(admin, { key: A.key, cart: [["zz-test-a", 2], ["zz-test-b", 1]], subtotal: 40000 });
    const count = (await admin.query("select count(*)::int n from orders where idempotency_key=$1", [A.key])).rows[0].n;
    check("same idempotency key => same order, no duplicate", again.orderId === A.orderId && again.replayed && count === 1);
    check("stock reserved once, not twice", (await product(admin, "zz-test-a")).stock_reserved === 2);
    check("idempotency key reused by another customer is rejected", await expectError(
      createOrder(admin, { key: A.key, email: "other@example.test", cart: [["zz-test-a", 2], ["zz-test-b", 1]], subtotal: 40000 }), /IDEMPOTENCY_CONFLICT/));
    check("client price tampering rejected (PRICE_CHANGED)", await expectError(
      createOrder(admin, { cart: [["zz-test-b", 1]], subtotal: 1 }), /PRICE_CHANGED/));
    check("unknown product rejected", await expectError(
      createOrder(admin, { cart: [["nope", 1]], subtotal: 100 }), /OUT_OF_STOCK/));
    check("quantity above limit rejected", await expectError(
      createOrder(admin, { cart: [["zz-test-b", 11]], subtotal: 220000 }), /VALIDATION/));
    check("order total constraint holds", (await admin.query("select total_paise from orders where id=$1", [A.orderId])).rows[0].total_paise == 40000);
  }

  console.log("Payment attempts");
  let payA;
  {
    const clients = await Promise.all(Array.from({ length: 6 }, newClient));
    const rs = await Promise.allSettled(clients.map((c) => attempt(c, A.orderId)));
    await Promise.all(clients.map((c) => c.end()));
    const live = (await admin.query("select count(*)::int n from payments where order_id=$1 and status in ('pending','initiated')", [A.orderId])).rows[0].n;
    check("6 concurrent payment starts => one live attempt", live === 1, `live=${live} ok=${rs.filter((r) => r.status === "fulfilled").length}`);
    payA = (await admin.query("select id from payments where order_id=$1", [A.orderId])).rows[0].id;
    await admin.query("select public.record_payment_session($1,$2)", [payA, "po_A"]);
    const again = await attempt(admin, A.orderId);
    check("restart returns the same session (reused)", again.reused === true && again.providerOrderId === "po_A");
  }

  console.log("Payment finalisation");
  {
    check("wrong amount never marks paid", (await finalize(admin, { pOrder: "po_A", amount: 100 })).result === "amount_mismatch"
      && (await order(admin, A.orderId)).payment_status !== "paid");
    // The mismatch failed that attempt; start a clean one for the real payment.
    const next = await attempt(admin, A.orderId);
    await admin.query("select public.record_payment_session($1,$2)", [next.paymentId, "po_A2"]);

    const evt = `evt-${randomUUID()}`;
    const r1 = await finalize(admin, { event: evt, pOrder: "po_A2", payment: "pay_A2", amount: 40000 });
    const o = await order(admin, A.orderId);
    check("verified payment => paid + placed", r1.result === "paid" && o.payment_status === "paid" && o.order_status === "placed");
    const pa = await product(admin, "zz-test-a");
    check("stock deducted and reservation cleared", pa.stock === 3 && pa.stock_reserved === 0, JSON.stringify(pa));

    const r2 = await finalize(admin, { event: evt, pOrder: "po_A2", payment: "pay_A2", amount: 40000 });
    check("duplicate webhook (same event id) is a no-op", r2.result === "duplicate");
    const r3 = await finalize(admin, { pOrder: "po_A2", payment: "pay_A2", amount: 40000 });
    const pa2 = await product(admin, "zz-test-a");
    check("replayed payment under a new event id: no second deduction", r3.result === "already_paid" && pa2.stock === 3, JSON.stringify(r3));
    check("a late 'failed' event cannot un-pay an order", (await finalize(admin, { pOrder: "po_A2", amount: 40000, outcome: "failed" })).result === "ignored_after_paid"
      && (await order(admin, A.orderId)).payment_status === "paid");
    check("unknown provider order is ignored safely", (await finalize(admin, { pOrder: "po_unknown", amount: 1 })).result === "unknown_payment");
    check("paid order cannot start a new payment", await expectError(attempt(admin, A.orderId), /ALREADY_PAID/));
  }

  console.log("Failed payment + retry");
  {
    const B = await createOrder(admin, { cart: [["zz-test-b", 2]], subtotal: 40000 });
    const p1 = await attempt(admin, B.orderId);
    await admin.query("select public.record_payment_session($1,$2)", [p1.paymentId, "po_B1"]);
    check("hold taken while paying", (await product(admin, "zz-test-b")).stock_reserved === 2);
    const f = await finalize(admin, { pOrder: "po_B1", amount: 40000, outcome: "failed" });
    const ob = await order(admin, B.orderId);
    check("failed payment: order NOT paid, still pending_payment", f.result === "failed" && ob.payment_status === "failed" && ob.order_status === "pending_payment");
    check("failed payment releases the hold", (await product(admin, "zz-test-b")).stock_reserved === 0);
    const p2 = await attempt(admin, B.orderId);
    const orders = (await admin.query("select count(*)::int n from orders where customer_email='guest@example.test' and total_paise=40000 and id=$1", [B.orderId])).rows[0].n;
    check("retry creates a new attempt, not a new order", p2.paymentId !== p1.paymentId && orders === 1);
    check("retry re-reserves stock", (await product(admin, "zz-test-b")).stock_reserved === 2);
    await admin.query("select public.record_payment_session($1,$2)", [p2.paymentId, "po_B2"]);
    check("retry can succeed", (await finalize(admin, { pOrder: "po_B2", payment: "pay_B2", amount: 40000 })).result === "paid");
  }

  console.log("Reservation expiry");
  {
    const C = await createOrder(admin, { cart: [["zz-test-c", 1]], subtotal: 5000 });
    check("last unit reserved", (await product(admin, "zz-test-c")).stock_reserved === 1);
    check("nobody else can buy the reserved unit", await expectError(createOrder(admin, { cart: [["zz-test-c", 1]], subtotal: 5000 }), /OUT_OF_STOCK/));
    await admin.query("update inventory_reservations set expires_at = now() - interval '1 minute' where order_id=$1", [C.orderId]);
    await admin.query("select public.expire_reservations()");
    const rs = (await admin.query("select status from inventory_reservations where order_id=$1", [C.orderId])).rows[0].status;
    check("expired hold is released", rs === "expired" && (await product(admin, "zz-test-c")).stock_reserved === 0);
    await admin.query("select public.expire_reservations()");
    check("expiry is idempotent (no double release)", (await product(admin, "zz-test-c")).stock_reserved === 0);
    // Customer pays after expiry, stock still free => honoured.
    const p = await attempt(admin, C.orderId);
    await admin.query("select public.record_payment_session($1,$2)", [p.paymentId, "po_C"]);
    await admin.query("update inventory_reservations set expires_at = now() - interval '1 minute' where order_id=$1", [C.orderId]);
    await admin.query("select public.expire_reservations()");
    check("late payment, stock still free => order placed", (await finalize(admin, { pOrder: "po_C", payment: "pay_C", amount: 5000 })).result === "paid"
      && (await product(admin, "zz-test-c")).stock === 0);

    // Late payment but someone else took the stock => refund flagged, never oversold.
    await admin.query("update products set stock = 1, stock_reserved = 0 where id='zz-test-c'");
    const D = await createOrder(admin, { cart: [["zz-test-c", 1]], subtotal: 5000 });
    const pd = await attempt(admin, D.orderId);
    await admin.query("select public.record_payment_session($1,$2)", [pd.paymentId, "po_D"]);
    await admin.query("update inventory_reservations set expires_at = now() - interval '1 minute' where order_id=$1", [D.orderId]);
    await admin.query("select public.expire_reservations()");
    const E = await createOrder(admin, { cart: [["zz-test-c", 1]], subtotal: 5000 });
    const lateD = await finalize(admin, { pOrder: "po_D", payment: "pay_D", amount: 5000 });
    const prod = await product(admin, "zz-test-c");
    check("late payment + stock gone => refund flagged, no oversell", lateD.result === "out_of_stock_refund_required" && prod.stock_reserved <= prod.stock,
      JSON.stringify({ lateD, prod }));
    check("refund_required is recorded on the payment", (await admin.query("select refund_required from payments where provider_order_id='po_D'")).rows[0].refund_required === true);
    void E;
    await admin.query("update orders set created_at = now() - interval '2 days' where id=$1", [E.orderId]);
    await admin.query("update inventory_reservations set expires_at = now() - interval '1 minute' where order_id=$1", [E.orderId]);
    await admin.query("select public.expire_reservations()");
    check("abandoned unpaid orders are cancelled after the grace period", (await order(admin, E.orderId)).order_status === "cancelled");
  }

  console.log("Guest isolation");
  {
    const t1 = token(), t2 = token();
    const G1 = await createOrder(admin, { email: "g1@example.test", cart: [["zz-test-b", 1]], subtotal: 20000, tokenHash: sha(t1) });
    const G2 = await createOrder(admin, { email: "g2@example.test", cart: [["zz-test-b", 1]], subtotal: 20000, tokenHash: sha(t2) });
    const get = async (num, t) => (await admin.query("select public.get_guest_order($1,$2) as r", [num, sha(t)])).rows[0].r;
    check("valid token returns the order", (await get(G1.orderNumber, t1))?.orderNumber === G1.orderNumber);
    check("another guest's token cannot read this order", (await get(G1.orderNumber, t2)) === null);
    check("garbage token returns nothing", (await get(G1.orderNumber, "x")) === null);
    const j = JSON.stringify(await get(G1.orderNumber, t1));
    check("guest payload carries no token hash / provider ids / email", !/guest_tracking|hash|provider|idempotency|customerEmail|email/i.test(j));
    check("guest order has no owner (constraint)", await expectError(
      admin.query("update orders set user_id = $1 where id=$2", [randomUUID(), G1.orderId]), /orders_ownership|violates/));

    console.log("Claiming guest orders");
    const uid = randomUUID();
    await admin.query("insert into auth.users (id, email, aud, role, instance_id) values ($1,$2,'authenticated','authenticated','00000000-0000-0000-0000-000000000000')", [uid, "zz-test-owner@example.test"]);
    created.users.push(uid);
    const claim = async (verifiedEmail, hashes) => (await admin.query("select public.claim_guest_orders($1,$2,$3::text[]) as n", [uid, verifiedEmail, hashes])).rows[0].n;
    check("claim with no proof claims nothing", (await claim(null, [])) === 0);
    check("an unverified email claims nothing", (await claim(null, [])) === 0 && (await order(admin, G2.orderId)).customer_type === "guest");
    check("a guessed/wrong token claims nothing", (await claim(null, [sha("nope")])) === 0);
    check("valid token claims exactly that order", (await claim(null, [sha(t1)])) === 1 && (await order(admin, G1.orderId)).user_id === uid);
    check("claimed order drops its guest token (old link dies)", (await get(G1.orderNumber, t1)) === null);
    check("verified email of ANOTHER address claims nothing", (await claim("someone-else@example.test", [])) === 0);
    check("verified email matching the order claims it", (await claim("g2@example.test", [])) === 1 && (await order(admin, G2.orderId)).user_id === uid);
  }

  console.log("Row Level Security");
  {
    const ua = randomUUID(), ub = randomUUID();
    for (const [id, em] of [[ua, "zz-test-a@example.test"], [ub, "zz-test-b@example.test"]]) {
      await admin.query("insert into auth.users (id, email, aud, role, instance_id) values ($1,$2,'authenticated','authenticated','00000000-0000-0000-0000-000000000000')", [id, em]);
      created.users.push(id);
    }
    const profile = (await admin.query("select count(*)::int n from profiles where id in ($1,$2)", [ua, ub])).rows[0].n;
    check("profile auto-created for new users", profile === 2);
    const R = await createOrder(admin, { userId: ua, email: "zz-test-a@example.test", cart: [["zz-test-b", 1]], subtotal: 20000 });
    await admin.query("insert into addresses (user_id, full_name, mobile, line1, area, city, state, pincode) values ($1,'Aa','9876543210','1 Test Street','Area','City','State','560001')", [ua]);

    const as = async (role, uid, fn) => {
      const c = await newClient();
      try {
        await c.query("begin");
        await c.query(`set local role ${role}`);
        await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(uid ? { sub: uid, role } : { role })]);
        return await fn(async (sql, params) => {
          await c.query("savepoint s");
          try {
            const r = await c.query(sql, params);
            await c.query("release savepoint s");
            return { ok: true, rows: r.rows, rowCount: r.rowCount };
          } catch (e) {
            await c.query("rollback to savepoint s");
            return { ok: false, error: e.message };
          }
        });
      } finally {
        await c.query("rollback").catch(() => {});
        await c.end();
      }
    };

    await as("authenticated", ua, async (q) => {
      check("owner sees own order", (await q("select id from orders")).rows.length >= 1 && (await q("select id from orders where id=$1", [R.orderId])).rows.length === 1);
      check("owner sees own items", (await q("select 1 from order_items where order_id=$1", [R.orderId])).rows.length === 1);
      check("owner sees own saved address", (await q("select 1 from addresses")).rows.length === 1);
      check("owner CANNOT update order status", !(await q("update orders set order_status='delivered' where id=$1", [R.orderId])).ok);
      check("owner CANNOT mark payment paid", !(await q("update orders set payment_status='paid' where id=$1", [R.orderId])).ok);
      check("owner CANNOT insert orders", !(await q("insert into orders (order_number) values ('x')")).ok);
      check("owner CANNOT read token hash column", !(await q("select guest_tracking_token_hash from orders")).ok);
      check("owner CANNOT read payments", !(await q("select * from payments")).ok);
      check("owner CANNOT read reservations / events / rate limits",
        !(await q("select * from inventory_reservations")).ok && !(await q("select * from payment_events")).ok && !(await q("select * from rate_limits")).ok);
      check("owner CANNOT change stock", !(await q("update products set stock = 999999")).ok);
      check("owner CANNOT call server functions", !(await q("select public.finalize_payment('x','e','t','o','p',1,'INR','paid',null,'{}')")).ok
        && !(await q("select public.claim_guest_orders($1,null,'{}')", [ua])).ok
        && !(await q("select public.create_checkout_order('k',null,'n','e','p','{}','[]',0,0,0,'h',1,1)")).ok);
      check("owner CANNOT create an address under another user_id", !(await q("insert into addresses (user_id, full_name, mobile, line1, area, city, state, pincode) values ($1,'Xx','9876543210','1 Test Street','Area','City','State','560001')", [ub])).ok);
      const me = await q("update profiles set full_name='Renamed' where id=$1 returning full_name", [ua]);
      check("owner can edit own profile name", me.ok && me.rows[0]?.full_name === "Renamed");
      check("owner CANNOT edit profile email", !(await q("update profiles set email='evil@example.test' where id=$1", [ua])).ok);
    });
    await as("authenticated", ub, async (q) => {
      check("another user sees none of A's orders", (await q("select id from orders where id=$1", [R.orderId])).rows.length === 0);
      check("another user sees none of A's items", (await q("select 1 from order_items where order_id=$1", [R.orderId])).rows.length === 0);
      check("another user sees none of A's addresses", (await q("select 1 from addresses")).rows.length === 0);
      check("another user cannot see A's profile", (await q("select 1 from profiles where id=$1", [ua])).rows.length === 0);
      check("another user cannot edit A's address", (await q("update addresses set city='Hacked' returning id")).rows.length === 0);
    });
    await as("anon", null, async (q) => {
      check("anonymous visitors can read the catalog", (await q("select id from products")).rows.length >= 3);
      check("anonymous visitors cannot read any order", !(await q("select id from orders")).ok);
      check("anonymous visitors cannot read profiles/addresses", !(await q("select 1 from profiles")).ok && !(await q("select 1 from addresses")).ok);
      check("anonymous visitors cannot write products", !(await q("update products set price_paise = 1")).ok);
      check("anonymous visitors cannot call server functions", !(await q("select public.get_guest_order('SW-1','h')")).ok && !(await q("select public.expire_reservations()")).ok);
    });
  }

  console.log("Rate limiting");
  {
    const rs = [];
    for (let i = 0; i < 7; i++) rs.push((await admin.query("select public.check_rate_limit('zz-test-rl', 5, 60) as ok")).rows[0].ok);
    check("6th request inside the window is refused", rs.slice(0, 5).every(Boolean) && !rs[5] && !rs[6]);
  }
} catch (error) {
  failures.push("unexpected error");
  console.error(error);
} finally {
  await cleanup().catch((e) => console.error("cleanup failed", e.message));
  await admin.end();
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("Failures:\n - " + failures.join("\n - "));
  process.exit(1);
}
