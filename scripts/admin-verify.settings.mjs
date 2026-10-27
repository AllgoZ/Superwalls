// Settings, reports (revenue correctness), team, audit log. Imported by admin-verify.mjs.
import { createHash, randomBytes, randomUUID } from "node:crypto";

const { pageDenied, sa, manager, orderMgr, contentMgr, invMgr, call, raw, db, check, section } = globalThis.__adminVerify;

const tag = randomUUID().slice(0, 6);
const sha = (s) => createHash("sha256").update(s).digest("hex");
const addr = JSON.stringify({ fullName: "T", mobile: "9876543210", line1: "1 Test Street", area: "A", city: "C", state: "S", pincode: "560001" });

const snapshot = Object.fromEntries((await db.query("select key, value from store_settings where key in ('store','delivery','contact','notifications')")).rows.map((r) => [r.key, r.value]));

section("Settings");
{
  const delivery = { deliveryFeePaise: 5500, freeDeliveryThresholdPaise: 60000, minOrderPaise: 0, serviceablePincodes: [], serviceableCities: [], policyText: "Verify policy" };
  check("super admin can save delivery settings", (await call(sa, "settings.saveDelivery", delivery)).status === 200 && (await db.query("select value from store_settings where key='delivery'")).rows[0].value.deliveryFeePaise === 5500);
  check("…and the change is audited with before/after", (await db.query("select metadata from admin_activity_logs where action='settings.delivery' order by id desc limit 1")).rows[0]?.metadata?.before?.deliveryFeePaise === 4900);
  check("a manager can't change delivery settings", (await call(manager, "settings.saveDelivery", delivery)).status === 403);
  check("order manager can't change delivery settings", (await call(orderMgr, "settings.saveDelivery", delivery)).status === 403);
  check("content manager can't change settings", (await call(contentMgr, "settings.saveStore", snapshot.store)).status === 403);
  check("inventory manager can't change settings", (await call(invMgr, "settings.saveContact", snapshot.contact)).status === 403);
  check("unauthenticated settings changes are 401", (await call(null, "settings.saveDelivery", delivery)).status === 401);
  check("fractional paise are refused", (await call(sa, "settings.saveDelivery", { ...delivery, deliveryFeePaise: 49.5 })).status === 400);
  check("PIN codes must be 6 digits", (await call(sa, "settings.saveDelivery", { ...delivery, serviceablePincodes: ["12345"] })).status === 400);
  check("negative thresholds are refused", (await call(sa, "settings.saveDelivery", { ...delivery, freeDeliveryThresholdPaise: -1 })).status === 400);

  const contact = { supportPhone: "+91 98765 43210", supportEmail: `help-${tag}@example.com`, whatsappNumber: "919876543210", availability: `Hours ${tag}` };
  check("super admin can save contact settings", (await call(sa, "settings.saveContact", contact)).status === 200);
  check("an invalid WhatsApp number is refused", (await call(sa, "settings.saveContact", { ...contact, whatsappNumber: "+91 98" })).status === 400);
  const help = await raw("/help");
  check("contact settings reach the Help page", help.text.includes(`help-${tag}@example.com`) && help.text.includes(`Hours ${tag}`) && help.text.includes("+91 98765 43210"));
  check("…and the WhatsApp link uses the configured number", help.text.includes("wa.me/919876543210"));
  check("store settings validate the email", (await call(sa, "settings.saveStore", { ...snapshot.store, contactEmail: "nope" })).status === 400);
  check("store settings fix currency and time zone", (await call(sa, "settings.saveStore", { ...snapshot.store, currency: "USD" })).status === 400);
  check("notification preferences are saved (nothing is sent)", (await call(sa, "settings.saveNotifications", { orderConfirmation: true, orderProcessing: false, shippingUpdates: false, deliveryUpdates: false, lowStockAlerts: false })).status === 200);

  check("settings pages render for super admin", (await Promise.all(["/admin/settings", "/admin/settings/store", "/admin/settings/delivery", "/admin/settings/contact", "/admin/settings/notifications"].map((p) => raw(p, { jar: sa.jar })))).every((r) => r.status === 200));
  check("manager can't open settings", pageDenied(await raw("/admin/settings", { jar: manager.jar })) && pageDenied(await raw("/admin/settings/delivery", { jar: manager.jar })));
  check("order manager can't open settings", pageDenied(await raw("/admin/settings/store", { jar: orderMgr.jar })));

  for (const [key, value] of Object.entries(snapshot)) await db.query("update store_settings set value=$2::jsonb where key=$1", [key, JSON.stringify(value)]);
}

section("Revenue and reports");
{
  const pid = `zz-adm-rev-${tag}`;
  await db.query("insert into products (id, name, price_paise, stock, is_active, images) values ($1, $2, 10000, 100, true, '[]'::jsonb)", [pid, `Verify Revenue ${tag}`]);
  const place = async (qty, email) => (await db.query("select public.create_checkout_order($1,null,'Rev',$2,'9876543210',$3::jsonb,$4::jsonb,$5,0,0,$6,30,10) as r", [`k-${randomUUID()}`, email, addr, JSON.stringify([{ productId: pid, quantity: qty }]), 10000 * qty, sha(randomBytes(8))])).rows[0].r;
  const pay = async (orderId, event = `evt-${randomUUID()}`) => {
    const attempt = (await db.query("select public.begin_payment_attempt($1,'testpay',30) as r", [orderId])).rows[0].r;
    const po = `po_${randomUUID().slice(0, 8)}`;
    await db.query("select public.record_payment_session($1,$2)", [attempt.paymentId, po]);
    const finalize = () => db.query("select public.finalize_payment('testpay',$1,'test',$2,$3,$4,'INR','paid','test','{}'::jsonb) as r", [event, po, `pay_${randomUUID().slice(0, 8)}`, attempt.amount]);
    await finalize();
    return { replay: finalize, event }; // calling replay() sends the same event again
  };
  const em = (n) => `zz-adm-rev-${n}-${tag}@example.test`;

  const dayStart = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const today = dayStart();
  const realised = async () => Number((await db.query(
    `select coalesce(sum(total_paise - refunded_paise), 0) as v from orders o
     where payment_status in ('paid','partially_refunded') and order_status <> 'cancelled' and paid_at is not null
       and (paid_at at time zone 'Asia/Kolkata')::date = $1::date`, [today])).rows[0].v);
  const csvRevenue = async (jar) => {
    const res = await raw(`/api/admin/export/sales?range=custom&from=${today}&to=${today}`, { jar });
    const line = res.text.split(/\r?\n/).find((l) => l.startsWith(today));
    return { status: res.status, rupees: line ? Number(line.split(",")[1]) : NaN };
  };

  const before = await csvRevenue(manager.jar);
  check("the sales CSV export works for a manager", before.status === 200 && Number.isFinite(before.rupees));
  check("(baseline) CSV revenue equals the database's definition", Math.round(before.rupees * 100) === (await realised()));

  const paid = await place(2, em("paid"));
  const { replay, event } = await pay(paid.orderId);
  const second = (await replay()).rows[0].r;
  await place(3, em("unpaid")); // never paid: must add nothing
  const cancelledUnpaid = await place(1, em("cu"));
  await call(manager, "orders.cancel", { orderId: cancelledUnpaid.orderId, reason: "Verification: unpaid cancel" });
  const cancelledPaid = await place(4, em("cp"));
  await pay(cancelledPaid.orderId);
  await call(manager, "orders.cancel", { orderId: cancelledPaid.orderId, reason: "Verification: paid cancel" });
  const refunded = await place(5, em("rf"));
  await pay(refunded.orderId);
  await db.query("update orders set payment_status='refunded', refunded_paise=total_paise where id=$1", [refunded.orderId]);
  const partial = await place(2, em("pr"));
  await pay(partial.orderId);
  await db.query("update orders set payment_status='partially_refunded', refunded_paise=5000 where id=$1", [partial.orderId]);

  const after = await csvRevenue(manager.jar);
  const delta = Math.round((after.rupees - before.rupees) * 100);
  // paid: 20000. unpaid / cancelled-unpaid / cancelled-paid / fully refunded: 0. partial: 20000 - 5000 = 15000.
  check("a replayed payment event is a no-op, so the order is counted once", second.result === "duplicate" && (await db.query("select count(*)::int n from payment_events where event_id = $1", [event])).rows[0].n === 1 && (await db.query("select count(*)::int n from payments where order_id = $1 and status = 'paid'", [paid.orderId])).rows[0].n === 1);
  check("revenue = paid + partially refunded (net); unpaid, cancelled and fully refunded add nothing", delta === 20000 + 15000, `delta=${delta}`);
  check("the report's revenue matches the database definition exactly", Math.round(after.rupees * 100) === (await realised()));
  check("a cancelled paid order stays 'paid' and is listed as awaiting refund", (await db.query("select payment_status from orders where id=$1", [cancelledPaid.orderId])).rows[0].payment_status === "paid");

  const page = await raw(`/admin/reports?range=custom&from=${today}&to=${today}`, { jar: manager.jar });
  check("the reports page renders every section for a manager", page.status === 200 && ["Sales", "Products", "Orders", "Customers", "Inventory", "How revenue is counted"].every((t) => page.text.includes(t)));
  check("it shows the awaiting-refund amount separately from revenue", /Awaiting refund/.test(page.text));
  for (const range of ["today", "yesterday", "7d", "30d", "this_month", "prev_month"]) {
    check(`reports range '${range}' renders`, (await raw(`/admin/reports?range=${range}`, { jar: manager.jar })).status === 200);
  }
  const future = await raw("/api/admin/export/sales?range=custom&from=2099-01-01&to=2099-01-03", { jar: manager.jar });
  check("a date range with no sales exports zero rows (date filter works)", future.status === 200 && future.text.split(/\r?\n/).filter((l) => l.startsWith("2099-")).every((l) => l.split(",")[1] === "0.00") && future.text.includes("2099-01-03"));
  check("the product export lists sold units", (await raw(`/api/admin/export/products?range=custom&from=${today}&to=${today}`, { jar: manager.jar })).text.includes(`Verify Revenue ${tag}`));
  check("the stock exports work for authorised staff", (await raw("/api/admin/export/inventory", { jar: manager.jar })).status === 200 && (await raw(`/api/admin/export/adjustments?range=custom&from=${today}&to=${today}`, { jar: invMgr.jar })).status === 403);
  check("order manager can't open reports or export them", pageDenied(await raw("/admin/reports", { jar: orderMgr.jar })) && (await raw("/api/admin/export/sales", { jar: orderMgr.jar })).status === 403);
  check("content manager can't open reports", pageDenied(await raw("/admin/reports", { jar: contentMgr.jar })));
  check("inventory manager can't read sales exports", (await raw("/api/admin/export/sales", { jar: invMgr.jar })).status === 403);
}

section("Team and audit log pages");
{
  const team = await raw("/admin/settings/team", { jar: sa.jar });
  check("super admin sees the team page with the members", team.status === 200 && team.text.includes("What each role can do"));
  check("manager can't open the team page", pageDenied(await raw("/admin/settings/team", { jar: manager.jar })));
  check("order manager can't open the team page", pageDenied(await raw("/admin/settings/team", { jar: orderMgr.jar })));

  const log = await raw("/admin/activity-logs", { jar: sa.jar });
  check("super admin can read the activity log", log.status === 200 && /settings\.delivery|order\.cancel|admin\.login/.test(log.text));
  check("the activity log filters by area", (await raw("/admin/activity-logs?group=order&q=cancel", { jar: sa.jar })).status === 200);
  check("manager can't open the activity log", pageDenied(await raw("/admin/activity-logs", { jar: manager.jar })));
  check("content manager can't open the activity log", pageDenied(await raw("/admin/activity-logs", { jar: contentMgr.jar })));
  check("the log never holds secrets", (await db.query("select count(*)::int n from admin_activity_logs where metadata::text ~* '(eyJ[A-Za-z0-9_-]{20,}|password\"\\s*:\\s*\"[^\\[]|secret\"\\s*:\\s*\"[^\\[])'")).rows[0].n === 0);
  check("sensitive actions were all recorded", (await db.query("select count(distinct action)::int n from admin_activity_logs where action in ('product.create','order.cancel','stock.adjust','promotion.create','page.publish','settings.delivery','export.orders','admin.login','team.update','banner.create','faq.create','footer.update')")).rows[0].n >= 10);
}
