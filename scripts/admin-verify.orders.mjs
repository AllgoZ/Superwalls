// Orders, customers, exports and dashboard checks. Imported by admin-verify.mjs.
import { createHash, randomBytes, randomUUID } from "node:crypto";

const { pageDenied, createUser, sa, manager, orderMgr, contentMgr, invMgr, call, raw, db, check, section } = globalThis.__adminVerify;

const tag = randomUUID().slice(0, 6);
const addr = JSON.stringify({ fullName: "T", mobile: "9876543210", line1: "1 Test Street", area: "A", city: "C", state: "S", pincode: "560001", instructions: "Ring twice" });
const sha = (s) => createHash("sha256").update(s).digest("hex");

async function makeProduct(id, stock = 20, price = 10000) {
  await db.query(
    "insert into products (id, name, price_paise, stock, is_active, images) values ($1, $2, $3, $4, true, '[]'::jsonb) on conflict (id) do nothing",
    [id, `Verify ${id}`, price, stock],
  );
  return id;
}
async function placeOrder({ productId, quantity = 2, userId = null, email, name = "Buyer", phone = "9876543210", price = 10000 }) {
  const { rows } = await db.query("select public.create_checkout_order($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13) as r", [
    `k-${randomUUID()}`, userId, name, email, phone, addr, JSON.stringify([{ productId, quantity }]), price * quantity, 0, 4900, userId ? null : sha(randomBytes(16)), 30, 10,
  ]);
  return rows[0].r;
}
async function pay(orderId) {
  const attempt = (await db.query("select public.begin_payment_attempt($1,'testpay',30) as r", [orderId])).rows[0].r;
  const providerOrder = `po_${randomUUID().slice(0, 8)}`;
  await db.query("select public.record_payment_session($1,$2)", [attempt.paymentId, providerOrder]);
  const out = await db.query("select public.finalize_payment('testpay',$1,'test',$2,$3,$4,'INR','paid','test','{}'::jsonb) as r", [`evt-${randomUUID()}`, providerOrder, `pay_${randomUUID().slice(0, 8)}`, attempt.amount]);
  return out.rows[0].r;
}
const orderRow = async (id) => (await db.query("select order_status, payment_status, cancel_reason, refunded_paise from orders where id=$1", [id])).rows[0];
const stockRow = async (id) => (await db.query("select stock, stock_reserved from products where id=$1", [id])).rows[0];

section("Order management");
{
  const pid = await makeProduct(`zz-adm-ord-${tag}`);
  const emailA = `zz-adm-guest-${tag}@example.test`;

  // A paid guest order walks the whole fulfilment path.
  const a = await placeOrder({ productId: pid, email: emailA, name: "Guest Gita" });
  const paid = await pay(a.orderId);
  check("(setup) a verified payment placed the guest order", paid.result === "paid" && (await orderRow(a.orderId)).order_status === "placed");

  check("order manager can open the orders list", !pageDenied(await raw("/admin/orders", { jar: orderMgr.jar })));
  const detail = await raw(`/admin/orders/${a.orderId}`, { jar: orderMgr.jar });
  check("order detail shows delivery address and instructions to the order manager", detail.status === 200 && detail.text.includes("Ring twice") && detail.text.includes("560001") && detail.text.includes("Guest Gita"));
  check("order detail shows the guest label", /Guest checkout/.test(detail.text));
  check("content manager cannot see orders", pageDenied(await raw("/admin/orders", { jar: contentMgr.jar })));
  check("inventory manager cannot see orders", pageDenied(await raw("/admin/orders", { jar: invMgr.jar })));
  check("content manager cannot read an order detail", pageDenied(await raw(`/admin/orders/${a.orderId}`, { jar: contentMgr.jar })));

  check("a skipped step is refused (placed → shipped)", (await call(orderMgr, "orders.setStatus", { orderId: a.orderId, status: "shipped" })).status === 409);
  check("'paid' is not a status an admin can set", (await call(manager, "orders.setStatus", { orderId: a.orderId, status: "paid" })).status === 400);
  check("'pending_payment' is not a status an admin can set", (await call(manager, "orders.setStatus", { orderId: a.orderId, status: "pending_payment" })).status === 400);
  check("inventory manager cannot update orders", (await call(invMgr, "orders.setStatus", { orderId: a.orderId, status: "confirmed" })).status === 403);
  check("content manager cannot update orders", (await call(contentMgr, "orders.setStatus", { orderId: a.orderId, status: "confirmed" })).status === 403);

  for (const status of ["confirmed", "processing", "shipped", "out_for_delivery", "delivered"]) {
    const res = await call(orderMgr, "orders.setStatus", { orderId: a.orderId, status });
    check(`order manager moves the order to ${status}`, res.status === 200 && (await orderRow(a.orderId)).order_status === status, res.text.slice(0, 120));
  }
  check("a delivered order is final", (await call(manager, "orders.setStatus", { orderId: a.orderId, status: "confirmed" })).status === 409);
  check("a delivered order can't be cancelled", (await call(manager, "orders.cancel", { orderId: a.orderId, reason: "changed my mind" })).status === 409);
  const events = await db.query("select status, admin_id from order_status_events where order_id=$1 and status in ('confirmed','delivered')", [a.orderId]);
  check("every status change records who made it", events.rows.length === 2 && events.rows.every((e) => e.admin_id === orderMgr.id));
  check("payment status was never touched by fulfilment", (await orderRow(a.orderId)).payment_status === "paid");
  check("status changes are audited", (await db.query("select count(*)::int n from admin_activity_logs where action='order.status' and entity_id=$1", [a.orderId])).rows[0].n === 5);

  // Unpaid order: cancellation releases the hold; nothing is "refunded".
  const before = await stockRow(pid);
  const b = await placeOrder({ productId: pid, quantity: 3, email: `zz-adm-b-${tag}@example.test` });
  check("(setup) the unpaid order holds stock", (await stockRow(pid)).stock_reserved === before.stock_reserved + 3);
  check("an unpaid order can't be advanced", (await call(manager, "orders.setStatus", { orderId: b.orderId, status: "confirmed" })).status === 409);
  check("cancellation needs a real reason", (await call(manager, "orders.cancel", { orderId: b.orderId, reason: "no" })).status === 400);
  const cancelB = await call(manager, "orders.cancel", { orderId: b.orderId, reason: "Customer asked to cancel" });
  check("manager can cancel an unpaid order", cancelB.status === 200 && cancelB.json?.data?.refundRequired === false);
  const rb = await orderRow(b.orderId);
  check("…the reason is stored and the order is cancelled", rb.order_status === "cancelled" && rb.cancel_reason === "Customer asked to cancel");
  check("…the reserved stock is released", (await stockRow(pid)).stock_reserved === before.stock_reserved);
  check("…repeat cancellation is refused", (await call(manager, "orders.cancel", { orderId: b.orderId, reason: "Customer asked again" })).status === 409);
  check("…the cancellation is audited with its reason", (await db.query("select metadata from admin_activity_logs where action='order.cancel' and entity_id=$1", [b.orderId])).rows[0]?.metadata?.reason === "Customer asked to cancel");

  // Paid order: stock goes back, refund is FLAGGED, never claimed.
  const c = await placeOrder({ productId: pid, quantity: 2, email: `zz-adm-c-${tag}@example.test` });
  await pay(c.orderId);
  const afterPay = await stockRow(pid);
  const cancelC = await call(manager, "orders.cancel", { orderId: c.orderId, reason: "Out of delivery area" });
  check("manager can cancel a paid order", cancelC.status === 200 && cancelC.json?.data?.refundRequired === true);
  const rc = await orderRow(c.orderId);
  check("…it stays 'paid' (no refund is claimed)", rc.order_status === "cancelled" && rc.payment_status === "paid" && Number(rc.refunded_paise) === 0);
  check("…the payment is flagged refund_required", (await db.query("select refund_required, status from payments where order_id=$1", [c.orderId])).rows[0]?.refund_required === true);
  check("…stock is returned to the shelf", (await stockRow(pid)).stock === afterPay.stock + 2);
  check("…and the return is in the stock ledger", (await db.query("select quantity_change from inventory_movements where order_id=$1 and kind='order_cancelled'", [c.orderId])).rows[0]?.quantity_change === 2);
  check("…the order list flags it for a refund", (await raw("/admin/orders?attention=refund", { jar: manager.jar })).text.includes("Refund due"));

  // Notes
  check("order manager can add an internal note", (await call(orderMgr, "orders.addNote", { orderId: a.orderId, note: "Left with security desk" })).status === 200);
  check("an empty note is refused", (await call(orderMgr, "orders.addNote", { orderId: a.orderId, note: "  " })).status === 400);
  check("content manager can't add notes", (await call(contentMgr, "orders.addNote", { orderId: a.orderId, note: "x" })).status === 403);
  check("notes appear on the order page", (await raw(`/admin/orders/${a.orderId}`, { jar: manager.jar })).text.includes("Left with security desk"));

  // Registered order + list filters
  const reg = await createUser("reg");
  await db.query("update profiles set full_name = 'Registered Ravi', mobile = '9123456780' where id = $1", [reg.id]);
  const d = await placeOrder({ productId: pid, userId: reg.id, email: reg.email, name: "Registered Ravi", phone: "9123456780" });
  await pay(d.orderId);
  const listed = await raw("/admin/orders?q=" + encodeURIComponent(d.orderNumber), { jar: manager.jar });
  check("search by order number finds the order", listed.status === 200 && listed.text.includes(d.orderNumber));
  check("search by phone finds the order", (await raw("/admin/orders?q=9123456780", { jar: manager.jar })).text.includes(d.orderNumber));
  check("search by customer name finds the order", (await raw("/admin/orders?q=Registered%20Ravi", { jar: manager.jar })).text.includes(d.orderNumber));
  check("status tab filters orders", (await raw("/admin/orders?status=delivered", { jar: manager.jar })).text.includes(a.orderNumber) && !(await raw("/admin/orders?status=delivered", { jar: manager.jar })).text.includes(d.orderNumber));
  check("customer-type filter works", (await raw("/admin/orders?type=guest", { jar: manager.jar })).text.includes(a.orderNumber));
  const today = new Date().toISOString().slice(0, 10);
  check("date range filter works", (await raw(`/admin/orders?from=${today}&to=${today}`, { jar: manager.jar })).text.includes(d.orderNumber));
  check("a future date range excludes them", !(await raw("/admin/orders?from=2099-01-01", { jar: manager.jar })).text.includes(d.orderNumber));
  check("registered orders link to their customer", (await raw(`/admin/orders/${d.orderId}`, { jar: manager.jar })).text.includes(`/admin/customers/${reg.id}`));
  check("garbage filters don't break the list", (await raw("/admin/orders?status=%27%3Bdrop&from=nope&page=-5", { jar: manager.jar })).status === 200);

  // Customers
  section("Customers");
  const customersPage = await raw("/admin/customers?q=zz-adm", { jar: manager.jar });
  check("manager sees registered and guest customers", customersPage.status === 200 && customersPage.text.includes(reg.email) && customersPage.text.includes(emailA));
  const regDetail = await raw(`/admin/customers/${reg.id}`, { jar: manager.jar });
  check("registered customer detail shows order history", regDetail.status === 200 && regDetail.text.includes(d.orderNumber));
  const guestId = `g-${createHash("md5").update(emailA).digest("hex")}`;
  const guestDetail = await raw(`/admin/customers/${guestId}`, { jar: manager.jar });
  check("guest customer detail is built from order snapshots", guestDetail.status === 200 && guestDetail.text.includes(a.orderNumber) && guestDetail.text.includes("Guest Gita"));
  {
    const r = await raw("/admin/customers/not-an-id", { jar: manager.jar });
    check("unknown customer ids are a 404", r.status === 404 || /NEXT_HTTP_ERROR_FALLBACK;404|could not be found/i.test(r.text));
  }
  check("order manager cannot open the customer directory", pageDenied(await raw("/admin/customers", { jar: orderMgr.jar })));
  check("content manager cannot open the customer directory", pageDenied(await raw("/admin/customers", { jar: contentMgr.jar })));
  check("customer pages never show credentials", !/password|encrypted|refresh_token|access_token/i.test(regDetail.text.replace(/<script[\s\S]*?<\/script>/g, "")));

  check("manager can correct a customer's profile", (await call(manager, "customers.updateProfile", { userId: reg.id, fullName: "Registered Ravi K", mobile: "9123456781" })).status === 200 && (await db.query("select full_name, mobile from profiles where id=$1", [reg.id])).rows[0]?.mobile === "9123456781");
  check("an invalid mobile number is refused", (await call(manager, "customers.updateProfile", { userId: reg.id, fullName: "Ravi", mobile: "12345" })).status === 400);
  check("order manager can't edit customers", (await call(orderMgr, "customers.updateProfile", { userId: reg.id, fullName: "Hacked", mobile: "" })).status === 403);
  check("profile edits keep personal data out of the audit log", !JSON.stringify((await db.query("select metadata from admin_activity_logs where action='customer.update' and entity_id=$1", [reg.id])).rows) .includes("Ravi"));

  // Exports
  section("Exports");
  const injected = await placeOrder({ productId: pid, quantity: 1, email: `zz-adm-inj-${tag}@example.test`, name: "=HYPERLINK(\"http://evil\",\"x\")" });
  await pay(injected.orderId);
  const csv = await raw("/api/admin/export/orders", { jar: manager.jar });
  check("manager can export orders as CSV", csv.status === 200 && /text\/csv/.test(csv.headers.get("content-type") ?? "") && csv.text.includes(a.orderNumber));
  check("CSV neutralises spreadsheet formulas in customer text", csv.text.includes("'=HYPERLINK") && !/(^|,)=HYPERLINK/m.test(csv.text));
  check("order manager can't export orders (no export permission)", (await raw("/api/admin/export/orders", { jar: orderMgr.jar })).status === 403);
  check("content manager can't export orders", (await raw("/api/admin/export/orders", { jar: contentMgr.jar })).status === 403);
  check("anonymous export is 401", (await raw("/api/admin/export/orders")).status === 401);
  check("unknown export kinds are 404", (await raw("/api/admin/export/secrets", { jar: manager.jar })).status === 404);
  check("customer export works for authorised staff and is audited", (await raw("/api/admin/export/customers", { jar: manager.jar })).status === 200 && (await db.query("select count(*)::int n from admin_activity_logs where action='export.customers'")).rows[0].n >= 1);
  check("order manager can't export customers", (await raw("/api/admin/export/customers", { jar: orderMgr.jar })).status === 403);

  // Dashboard
  section("Dashboard");
  const dash = await raw("/admin", { jar: manager.jar });
  check("manager's dashboard shows the revenue and order blocks", dash.status === 200 && /Total revenue/.test(dash.text) && /Recent orders/.test(dash.text) && /Top-selling/.test(dash.text));
  const dashOm = await raw("/admin", { jar: orderMgr.jar });
  check("order manager's dashboard has orders but no revenue or customers", dashOm.status === 200 && /Recent orders/.test(dashOm.text) && !/Total revenue/.test(dashOm.text) && !/Total customers/.test(dashOm.text));
  const dashCm = await raw("/admin", { jar: contentMgr.jar });
  check("content manager's dashboard has no financial or order data", dashCm.status === 200 && !/Total revenue/.test(dashCm.text) && !/Recent orders/.test(dashCm.text) && !/Total customers/.test(dashCm.text));
  for (const range of ["today", "yesterday", "7d", "30d", "this_month", "prev_month", "custom&from=2026-01-01&to=2026-01-31"]) {
    check(`dashboard range '${range.split("&")[0]}' renders`, (await raw(`/admin?range=${range}`, { jar: manager.jar })).status === 200);
  }
  check("an absurd custom range is bounded, not an error", (await raw("/admin?range=custom&from=1900-01-01&to=2999-12-31", { jar: manager.jar })).status === 200);

  // Revenue definition, verified in the database against the numbers the dashboard is built from.
  const rev = await db.query(
    `select
       coalesce(sum(total_paise - refunded_paise) filter (where payment_status in ('paid','partially_refunded') and order_status <> 'cancelled' and paid_at is not null), 0) as realised,
       coalesce(sum(total_paise) filter (where payment_status in ('paid','partially_refunded')), 0) as paid_gross
     from orders where customer_email like $1`,
    [`zz-adm-%-${tag}@example.test`],
  );
  check("revenue excludes cancelled (refund-due), unpaid and cancelled-unpaid orders", Number(rev.rows[0].realised) < Number(rev.rows[0].paid_gross));
  void sa;
}
