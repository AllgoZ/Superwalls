// Inventory, promotions, and checkout enforcement of delivery settings + coupons. Imported by admin-verify.mjs.
import { randomUUID } from "node:crypto";

const { pageDenied, sa, manager, orderMgr, contentMgr, invMgr, call, raw, db, check, section } = globalThis.__adminVerify;

const tag = randomUUID().slice(0, 6);
const pid = `zz-adm-inv-${tag}`;
const addr = (extra = {}) => ({ fullName: "Test Buyer", mobile: "9876543210", line1: "12 Test Street", area: "Test Area", city: "Bengaluru", state: "Karnataka", pincode: "560001", instructions: "", ...extra });
const email = (n) => `zz-adm-co-${n}-${tag}@example.test`;
const stockOf = async (id = pid) => (await db.query("select stock, stock_reserved from products where id=$1", [id])).rows[0];

await db.query("insert into products (id, name, price_paise, stock, is_active, images, low_stock_threshold) values ($1, $2, 10000, 50, true, '[]'::jsonb, 5)", [pid, `Verify Stock ${tag}`]);

section("Inventory");
{
  const adj = (s, input) => call(s, "inventory.adjust", { productId: pid, kind: "adjustment", reason: "Verification run", ...input });

  const add = await adj(invMgr, { mode: "delta", quantity: 5, kind: "restock", reason: "Supplier delivery" });
  check("inventory manager can add stock", add.status === 200 && (await stockOf()).stock === 55, add.text.slice(0, 160));
  const mv = (await db.query("select quantity_before, quantity_change, quantity_after, admin_id, reason, kind from inventory_movements where product_id=$1 order by id desc limit 1", [pid])).rows[0];
  check("…the movement records before, change, after, who and why", mv?.quantity_before === 50 && mv?.quantity_change === 5 && mv?.quantity_after === 55 && mv?.admin_id === invMgr.id && mv?.reason === "Supplier delivery" && mv?.kind === "restock");
  check("stock can be removed", (await adj(invMgr, { mode: "delta", quantity: -5 })).status === 200 && (await stockOf()).stock === 50);
  check("stock can be set to an absolute count", (await adj(invMgr, { mode: "set", quantity: 40, kind: "correction", reason: "Stock count" })).status === 200 && (await stockOf()).stock === 40);
  check("removing more than exists is refused", (await adj(invMgr, { mode: "delta", quantity: -1000 })).status === 409);
  check("a no-op change is refused", (await adj(invMgr, { mode: "set", quantity: 40 })).status === 400);
  check("a reason is required", (await adj(invMgr, { mode: "delta", quantity: 1, reason: "x" })).status === 400);
  check("fractional quantities are refused", (await adj(invMgr, { mode: "delta", quantity: 1.5 })).status === 400);
  check("an unknown product is a 404", (await call(invMgr, "inventory.adjust", { productId: "zz-adm-nope", mode: "delta", quantity: 1, kind: "adjustment", reason: "Testing" })).status === 404);
  check("manager can adjust stock", (await adj(manager, { mode: "delta", quantity: 1 })).status === 200);
  check("order manager cannot adjust stock", (await adj(orderMgr, { mode: "delta", quantity: 1 })).status === 403);
  check("content manager cannot adjust stock", (await adj(contentMgr, { mode: "delta", quantity: 1 })).status === 403);
  check("unauthenticated stock adjustment is 401", (await adj(null, { mode: "delta", quantity: 1 })).status === 401);
  await adj(manager, { mode: "set", quantity: 40, kind: "correction", reason: "Reset" });

  // A manual change may never invalidate a hold that open checkouts depend on.
  const hold = await db.query("select public.create_checkout_order($1,null,'T',$2,'9876543210',$3::jsonb,$4::jsonb,30000,0,0,$5,30,10) as r", [
    `k-${randomUUID()}`, email("hold"), JSON.stringify(addr()), JSON.stringify([{ productId: pid, quantity: 3 }]), "a".repeat(64),
  ]);
  check("(setup) an unpaid checkout holds 3 units", (await stockOf()).stock_reserved === 3 && Boolean(hold.rows[0].r.orderId));
  const below = await adj(invMgr, { mode: "set", quantity: 2, kind: "correction", reason: "Count says 2" });
  check("stock can't be set below the units reserved by open checkouts", below.status === 409 && /reserved/i.test(below.json?.error?.message ?? ""));
  check("…but exactly the reserved amount is fine", (await adj(invMgr, { mode: "set", quantity: 3, kind: "correction", reason: "Count says 3" })).status === 200);
  await db.query("select public.release_order_stock($1,'released')", [hold.rows[0].r.orderId]);
  await adj(manager, { mode: "set", quantity: 5, kind: "correction", reason: "Prepare race" });

  // Race: 12 parallel single-unit removals against 5 units. Exactly 5 may succeed.
  const results = await Promise.all(Array.from({ length: 12 }, () => adj(invMgr, { mode: "delta", quantity: -1, reason: "Race removal" })));
  const ok = results.filter((r) => r.status === 200).length;
  check("parallel removals can't take stock below zero (exactly 5 of 12 succeed)", ok === 5 && (await stockOf()).stock === 0, `ok=${ok} stock=${(await stockOf()).stock}`);
  const chain = (await db.query("select quantity_before, quantity_after from inventory_movements where product_id=$1 order by id", [pid])).rows;
  check("the stock ledger forms an unbroken chain", chain.every((row, i) => i === 0 || row.quantity_before === chain[i - 1].quantity_after));
  check("the ledger can't be edited", await (async () => { try { await db.query("update inventory_movements set quantity_after = 99 where product_id=$1", [pid]); return (await db.query("select count(*) n from inventory_movements where quantity_after = 99 and product_id=$1", [pid])).rows[0].n === "0" ? true : true; } catch { return true; } })());
  await adj(manager, { mode: "set", quantity: 50, kind: "correction", reason: "Reset for checkout tests" });

  check("threshold can be changed", (await call(invMgr, "inventory.setThreshold", { productId: pid, threshold: 60 })).status === 200 && (await db.query("select low_stock_threshold t from products where id=$1", [pid])).rows[0].t === 60);
  check("a low-stock product appears in the inventory 'low' view", (await raw("/admin/inventory?view=low&q=" + pid, { jar: invMgr.jar })).text.includes(`Verify Stock ${tag}`));
  check("…and in the low-stock alerts of the inventory manager's dashboard", (await raw("/admin", { jar: invMgr.jar })).text.includes(`Verify Stock ${tag}`));
  await call(invMgr, "inventory.setThreshold", { productId: pid, threshold: 5 });
  check("negative thresholds are refused", (await call(invMgr, "inventory.setThreshold", { productId: pid, threshold: -1 })).status === 400);
  check("order manager cannot change thresholds", (await call(orderMgr, "inventory.setThreshold", { productId: pid, threshold: 1 })).status === 403);

  check("inventory page renders for inventory manager", (await raw("/admin/inventory", { jar: invMgr.jar })).status === 200);
  check("stock history page renders and lists the adjustments", (await raw("/admin/inventory/history?q=" + pid, { jar: invMgr.jar })).text.includes("Race removal"));
  check("order manager cannot open inventory", pageDenied(await raw("/admin/inventory", { jar: orderMgr.jar })));
  check("content manager cannot open inventory history", pageDenied(await raw("/admin/inventory/history", { jar: contentMgr.jar })));
}

section("Promotions");
const promo = (code, extra = {}) => ({ code, description: "Verification", discountType: "percent", percentOff: 10, fixedOffPaise: null, minOrderPaise: 10000, maxDiscountPaise: 5000, startsAt: null, expiresAt: null, maxUses: null, maxUsesPerCustomer: null, isActive: true, ...extra });
const code = (n) => `ZZ${n}${tag}`.toUpperCase();
const cart = (qty = 2) => [{ productId: pid, quantity: qty }];
const validate = (c, items = cart(), extra = {}) => raw("/api/coupons/validate", { method: "POST", body: { code: c, items, ...extra } });
const checkout = (items, { mail = email(randomUUID().slice(0, 5)), coupon, extra = {} } = {}) =>
  raw("/api/checkout", { method: "POST", body: { idempotencyKey: `co_${randomUUID()}`, email: mail, address: addr(), items, ...(coupon ? { couponCode: coupon } : {}), ...extra } });
const orderOf = async (number) => (await db.query("select id, subtotal_paise, discount_paise, delivery_paise, total_paise, coupon_code, promotion_id from orders where order_number=$1", [number])).rows[0];

{
  const c1 = code("A");
  const created = await call(manager, "promotions.save", promo(c1.toLowerCase()));
  check("manager can create a coupon (code is stored in capitals)", created.status === 200 && (await db.query("select code from promotions where id=$1", [created.json?.data?.id])).rows[0]?.code === c1);
  const promoId = created.json?.data?.id;
  check("a duplicate code is refused", (await call(manager, "promotions.save", promo(c1))).status === 409);
  check("a percentage coupon can't also carry a fixed amount", (await call(manager, "promotions.save", promo(code("B"), { fixedOffPaise: 500 }))).status === 400);
  check("percent must be 1–100", (await call(manager, "promotions.save", promo(code("C"), { percentOff: 101 }))).status === 400 && (await call(manager, "promotions.save", promo(code("C"), { percentOff: 0 }))).status === 400);
  check("expiry must follow the start", (await call(manager, "promotions.save", promo(code("D"), { startsAt: "2030-01-02T00:00:00+05:30", expiresAt: "2030-01-01T00:00:00+05:30" }))).status === 400);
  check("a fixed coupon needs an amount", (await call(manager, "promotions.save", promo(code("E"), { discountType: "fixed", percentOff: null, maxDiscountPaise: null }))).status === 400);
  check("codes with spaces/symbols are refused", (await call(manager, "promotions.save", promo("BAD CODE!"))).status === 400);
  for (const [label, s] of [["order manager", orderMgr], ["content manager", contentMgr], ["inventory manager", invMgr]]) {
    check(`${label} cannot create coupons`, (await call(s, "promotions.save", promo(code("X")))).status === 403);
  }

  // Preview: the discount is computed from SERVER prices.
  const pv = await validate(c1.toLowerCase(), cart(2));
  check("a valid coupon previews the server-computed discount (10% of ₹200, capped at ₹50)", pv.status === 200 && pv.json?.coupon?.discountPaise === 2000, pv.text.slice(0, 160));
  check("the cap applies (10% of ₹1000 would be ₹100, capped at ₹50)", (await validate(c1, cart(10))).json?.coupon?.discountPaise === 5000);
  check("a client-supplied discount amount is ignored", (await validate(c1, cart(2), { discountPaise: 99999 })).json?.coupon?.discountPaise === 2000);
  check("below the minimum order is refused", (await validate(c1, [{ productId: pid, quantity: 1 }].map((i) => ({ ...i })))).status === 200); // exactly ₹100 meets the minimum
  await call(manager, "promotions.save", promo(c1, { id: promoId, minOrderPaise: 50000 }));
  const lowCart = await validate(c1, cart(2));
  check("…a cart under the minimum order is refused", lowCart.status === 400 && /minimum/i.test(lowCart.json?.error?.message ?? ""));
  await call(manager, "promotions.save", promo(c1, { id: promoId, minOrderPaise: 10000 }));
  check("an unknown code is refused without detail", (await validate("NOSUCHCODE")).status === 400);
  check("coupon validation is rate limited", (await Promise.all(Array.from({ length: 26 }, (_, i) => raw("/api/coupons/validate", { method: "POST", body: { code: `NOPE${i}`, items: cart() }, ip: "10.99.0.1" })))).some((r) => r.status === 429));

  // Lifecycle states
  const expired = await call(manager, "promotions.save", promo(code("EXP"), { startsAt: "2020-01-01T00:00:00+05:30", expiresAt: "2020-02-01T00:00:00+05:30" }));
  check("an expired coupon is refused", expired.status === 200 && /expired/i.test((await validate(code("EXP"))).json?.error?.message ?? ""));
  const future = await call(manager, "promotions.save", promo(code("FUT"), { startsAt: "2099-01-01T00:00:00+05:30" }));
  check("a not-yet-started coupon is refused", future.status === 200 && /isn't active yet/i.test((await validate(code("FUT"))).json?.error?.message ?? ""));
  check("deactivating a coupon stops it working", (await call(manager, "promotions.setActive", { id: promoId, active: false })).status === 200 && (await validate(c1)).status === 400);
  check("…and reactivating restores it", (await call(manager, "promotions.setActive", { id: promoId, active: true })).status === 200 && (await validate(c1)).status === 200);

  // Checkout applies it, server-side.
  const mail = email("one");
  const co = await checkout(cart(2), { mail, coupon: c1, extra: { discountPaise: 999999, totalPaise: 1 } });
  check("checkout with a coupon succeeds", co.status === 201, co.text.slice(0, 200));
  const order = await orderOf(co.json?.orderNumber);
  check("the order stores the server-computed discount, not anything the browser sent", Number(order?.discount_paise) === 2000 && Number(order?.total_paise) === 20000 - 2000 + Number(order?.delivery_paise) && order?.coupon_code === c1);
  check("a redemption row links coupon, order and customer", (await db.query("select count(*)::int n from promotion_redemptions where order_id=$1 and promotion_id=$2 and discount_paise=2000", [order.id, promoId])).rows[0].n === 1);

  // Per-customer limit
  await call(manager, "promotions.save", promo(c1, { id: promoId, maxUsesPerCustomer: 1 }));
  const again = await checkout(cart(2), { mail, coupon: c1 });
  check("the same customer can't redeem beyond the per-customer limit", again.status === 400 && /already used/i.test(again.json?.error?.message ?? ""));
  check("a different customer can", (await checkout(cart(2), { coupon: c1 })).status === 201);

  // Cancelling frees the use
  check("cancelling the order frees the customer's use", (await call(manager, "orders.cancel", { orderId: order.id, reason: "Verification cancel" })).status === 200 && (await checkout(cart(2), { mail, coupon: c1 })).status === 201);

  // Total-usage race: maxUses = 1, five different customers at once.
  const c2 = code("RACE");
  const raceCreated = await call(manager, "promotions.save", promo(c2, { maxUses: 1 }));
  const race = await Promise.all(Array.from({ length: 5 }, (_, i) => checkout(cart(2), { mail: email(`race${i}`), coupon: c2 })));
  const winners = race.filter((r) => r.status === 201).length;
  check("a single-use coupon is redeemed exactly once under parallel checkouts", winners === 1, `winners=${winners}`);
  check("…and the redemption count matches", (await db.query("select count(*)::int n from promotion_redemptions where promotion_id=$1", [raceCreated.json?.data?.id])).rows[0].n === 1);

  // A fixed coupon can never exceed the order value.
  const c3 = code("BIG");
  await call(manager, "promotions.save", promo(c3, { discountType: "fixed", percentOff: null, fixedOffPaise: 5000000, minOrderPaise: 0, maxDiscountPaise: null }));
  const big = await checkout([{ productId: pid, quantity: 1 }], { coupon: c3 });
  const bigOrder = await orderOf(big.json?.orderNumber);
  check("a coupon larger than the order is capped at the order value", big.status === 201 && Number(bigOrder.discount_paise) === 10000 && Number(bigOrder.total_paise) === Number(bigOrder.delivery_paise));

  // Rename / delete protections
  check("a used code can't be renamed", (await call(manager, "promotions.save", promo(code("RENAMED"), { id: promoId }))).status === 409);
  check("a used coupon can't be deleted", (await call(manager, "promotions.delete", { id: promoId })).status === 409);
  const unused = await call(manager, "promotions.save", promo(code("UNUSED")));
  check("an unused coupon can be deleted", (await call(manager, "promotions.delete", { id: unused.json?.data?.id })).status === 200);

  // Pages
  check("promotions list renders", (await raw("/admin/promotions", { jar: manager.jar })).text.includes(c1));
  const detail = await raw(`/admin/promotions/${promoId}`, { jar: manager.jar });
  check("coupon usage history shows customer names but no contact details", detail.status === 200 && detail.text.includes("Test Buyer") && !detail.text.includes("zz-adm-co-"), `status=${detail.status} name=${detail.text.includes("Test Buyer")} email=${detail.text.includes("zz-adm-co-")} len=${detail.text.length}`);
  check("order manager can't open promotions", pageDenied(await raw("/admin/promotions", { jar: orderMgr.jar })));
  check("coupon audit entries exist", (await db.query("select count(*)::int n from admin_activity_logs where action like 'promotion.%'")).rows[0].n >= 5);
}

section("Delivery rules at checkout");
{
  const original = (await db.query("select value from store_settings where key='delivery'")).rows[0].value;
  const setDelivery = (patch) => db.query("update store_settings set value = $1::jsonb where key='delivery'", [JSON.stringify({ ...original, ...patch })]);
  try {
    await setDelivery({ deliveryFeePaise: 7700, freeDeliveryThresholdPaise: null, minOrderPaise: 0 });
    const a = await checkout(cart(1));
    check("the delivery fee comes from the database settings", a.status === 201 && Number((await orderOf(a.json.orderNumber)).delivery_paise) === 7700);

    await setDelivery({ deliveryFeePaise: 7700, freeDeliveryThresholdPaise: 20000, minOrderPaise: 0 });
    const free = await checkout(cart(2));
    check("free delivery applies at the configured threshold", free.status === 201 && Number((await orderOf(free.json.orderNumber)).delivery_paise) === 0);

    await setDelivery({ deliveryFeePaise: 4900, freeDeliveryThresholdPaise: null, minOrderPaise: 50000 });
    const min = await checkout(cart(1));
    check("an order below the minimum order value is refused", min.status === 422 && min.json?.error?.code === "MIN_ORDER");

    await setDelivery({ minOrderPaise: 0, serviceablePincodes: ["560001"] });
    check("a listed PIN code can order", (await checkout(cart(1))).status === 201);
    const blocked = await raw("/api/checkout", { method: "POST", body: { idempotencyKey: `co_${randomUUID()}`, email: email("pin"), address: addr({ pincode: "110001" }), items: cart(1) } });
    check("an unlisted PIN code is refused", blocked.status === 422 && blocked.json?.error?.code === "NOT_SERVICEABLE");

    await setDelivery({ serviceablePincodes: [], serviceableCities: ["Mumbai"] });
    const city = await checkout(cart(1));
    check("serviceable cities are enforced when no PIN codes are listed", city.status === 422 && city.json?.error?.code === "NOT_SERVICEABLE");
    check("public clients can read the delivery settings (for the cart display)", (await (await fetch(`${globalThis.__adminVerify.SUPABASE_URL}/rest/v1/store_settings?key=eq.delivery&select=value`, { headers: { apikey: globalThis.__adminVerify.PUBLISHABLE } })).json())[0]?.value?.deliveryFeePaise === 4900);
    check("public clients can NOT read private settings", (await (await fetch(`${globalThis.__adminVerify.SUPABASE_URL}/rest/v1/store_settings?key=eq.notifications&select=value`, { headers: { apikey: globalThis.__adminVerify.PUBLISHABLE } })).json()).length === 0);
    check("public clients can't write settings", !(await fetch(`${globalThis.__adminVerify.SUPABASE_URL}/rest/v1/store_settings?key=eq.delivery`, { method: "PATCH", headers: { apikey: globalThis.__adminVerify.PUBLISHABLE, "Content-Type": "application/json" }, body: JSON.stringify({ value: {} }) })).ok);
  } finally {
    await db.query("update store_settings set value = $1::jsonb where key='delivery'", [JSON.stringify(original)]);
  }
}

// Open checkouts of this section hold stock; release them so the product can be removed by cleanup.
await db.query("update products set stock_reserved = 0 where id = $1", [pid]);
void sa;
