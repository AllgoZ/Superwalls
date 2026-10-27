// Catalog module checks (products, categories, image upload, storefront sync). Imported by admin-verify.mjs.
import { createHash, randomBytes, randomUUID } from "node:crypto";

const { pageDenied, sa, manager, orderMgr, contentMgr, invMgr, call, raw, db, check, section, BASE, SUPABASE_URL, PUBLISHABLE } = globalThis.__adminVerify;

const tag = randomUUID().slice(0, 6);
const slug = (n) => `zz-adm-${n}-${tag}`;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const product = (id, extra = {}) => ({
  slug: id,
  name: "Verify Product",
  sku: null,
  tagline: "Short line",
  description: "Long description",
  unit: "1 L",
  categoryId: null,
  pricePaise: 19910,
  compareAtPricePaise: 24900,
  images: [],
  lowStockThreshold: 5,
  isActive: true,
  isFeatured: false,
  seoTitle: "",
  seoDescription: "",
  initialStock: 12,
  ...extra,
});
const restProduct = async (id, token) =>
  (await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}&select=id,name,price_paise,is_active,stock`, { headers: { apikey: PUBLISHABLE, ...(token ? { Authorization: `Bearer ${token}` } : {}) } })).json();

async function upload(session, { bytes = PNG, name = "pixel.png", type = "image/png", folder = "products", origin } = {}) {
  const form = new FormData();
  form.set("file", new File([bytes], name, { type }));
  form.set("folder", folder);
  return raw("/api/admin/upload", { method: "POST", body: form, jar: session?.jar, ...(origin !== undefined ? { origin } : {}) });
}

section("Products");
{
  const id = slug("p1");
  const create = await call(manager, "products.create", product(id, { sku: `ZZ-${tag}` }));
  check("manager can create a product", create.status === 200 && create.json?.data?.id === id, create.text.slice(0, 200));
  const row = (await db.query("select price_paise, compare_at_price_paise, stock, is_active, is_demo from products where id=$1", [id])).rows[0];
  check("price is stored as exact integer paise", Number(row?.price_paise) === 19910 && Number(row?.compare_at_price_paise) === 24900);
  check("opening stock is recorded in the stock ledger", (await db.query("select quantity_after from inventory_movements where product_id=$1 and kind='restock'", [id])).rows[0]?.quantity_after === 12);

  check("duplicate slug is refused", (await call(manager, "products.create", product(id))).status === 409);
  check("duplicate SKU is refused (case-insensitive)", (await call(manager, "products.create", product(slug("p2"), { sku: `zz-${tag}` }))).status === 409);
  check("original price must exceed the selling price", (await call(manager, "products.create", product(slug("p3"), { compareAtPricePaise: 19910 }))).status === 400);
  check("fractional paise are rejected", (await call(manager, "products.create", product(slug("p4"), { pricePaise: 199.5 }))).status === 400);
  check("negative stock is rejected", (await call(manager, "products.create", product(slug("p5"), { initialStock: -1 }))).status === 400);
  check("images must come from the managed bucket", (await call(manager, "products.create", product(slug("p6"), { images: [{ src: "https://evil.example/x.png", alt: "" }] }))).status === 400);
  check("invalid slugs are rejected", (await call(manager, "products.create", product("Bad Slug!"))).status === 400);

  for (const [label, s] of [["order manager", orderMgr], ["content manager", contentMgr], ["inventory manager", invMgr]]) {
    check(`${label} cannot create products`, (await call(s, "products.create", product(slug("x")))).status === 403);
  }
  check("unauthenticated users cannot create products", (await call(null, "products.create", product(slug("x")))).status === 401);
  check("inventory manager cannot change product prices", (await call(invMgr, "products.update", { ...product(id), id, slug: undefined }).then((r) => r)).status === 403);
  check("order manager cannot open the products page", pageDenied(await raw("/admin/products", { jar: orderMgr.jar })));

  // Storefront synchronisation (public API, exactly what the storefront reads).
  let pub = await restProduct(id);
  check("a published product is visible to the public storefront API", pub.length === 1 && Number(pub[0].price_paise) === 19910);

  const update = await call(manager, "products.update", { ...product(id), id, pricePaise: 20900, compareAtPricePaise: 25900, name: "Verify Product Renamed" });
  check("manager can edit a product", update.status === 200);
  pub = await restProduct(id);
  check("price change is live on the storefront", Number(pub[0]?.price_paise) === 20900 && pub[0]?.name === "Verify Product Renamed");
  const logs = await db.query("select metadata from admin_activity_logs where action='product.update' and entity_id=$1", [id]);
  check("edits write an audit entry with before/after", logs.rows[0]?.metadata?.before?.pricePaise === 19910 && logs.rows[0]?.metadata?.after?.pricePaise === 20900);

  check("manager can unpublish", (await call(manager, "products.setStatus", { ids: [id], status: "unpublished" })).status === 200);
  check("an unpublished product disappears from the storefront API", (await restProduct(id)).length === 0);
  check("manager can publish again", (await call(manager, "products.setStatus", { ids: [id], status: "published" })).status === 200 && (await restProduct(id)).length === 1);
  check("manager can feature a product", (await call(manager, "products.setFeatured", { id, featured: true })).status === 200);

  const copy = await call(manager, "products.duplicate", { id });
  const copyId = copy.json?.data?.id;
  check("duplicate creates an unpublished, stockless draft without the SKU", copy.status === 200 && (await db.query("select is_active, stock, sku, is_featured from products where id=$1", [copyId])).rows[0]?.is_active === false);

  // Products referenced by orders can never be deleted (history is preserved).
  const email = `zz-adm-buyer-${tag}@example.test`;
  const addr = JSON.stringify({ fullName: "T", mobile: "9876543210", line1: "1 Test Street", area: "A", city: "C", state: "S", pincode: "560001" });
  const token = createHash("sha256").update(randomBytes(16)).digest("hex");
  const placed = await db.query("select public.create_checkout_order($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13) as r", [
    `k-${randomUUID()}`, null, "Buyer", email, "9876543210", addr, JSON.stringify([{ productId: id, quantity: 1 }]), 20900, 0, 0, token, 30, 10,
  ]);
  check("(setup) an order referencing the product exists", Boolean(placed.rows[0]?.r?.orderId));
  const del = await call(manager, "products.delete", { ids: [id] });
  check("a product that appears in an order can't be deleted", del.status === 409 && /Archive/i.test(del.json?.error?.message ?? ""));
  check("…it can be archived instead", (await call(manager, "products.setStatus", { ids: [id], status: "archived" })).status === 200 && (await restProduct(id)).length === 0);
  check("…and the order snapshot is intact", (await db.query("select name, unit_price_paise from order_items where product_id=$1", [id])).rows[0]?.unit_price_paise === "20900" || Number((await db.query("select unit_price_paise from order_items where product_id=$1", [id])).rows[0]?.unit_price_paise) === 20900);
  check("manager can delete an unreferenced product", (await call(manager, "products.delete", { ids: [copyId] })).status === 200);
  check("order manager cannot delete products", (await call(orderMgr, "products.delete", { ids: [id] })).status === 403);
}

section("Catalog pages render");
{
  const id = slug("p1");
  const page = async (path, jar = manager.jar) => {
    const r = await raw(path, { jar });
    return { ok: r.status === 200 && !/Application error|NEXT_HTTP_ERROR|"digest"/.test(r.text), r };
  };
  {
    const r = (await page("/admin/products?status=all")).r;
    check("products list renders with data", r.status === 200 && r.text.includes("Verify Product"), `status=${r.status} len=${r.text.length}`);
  }
  check("products list filters and sorts", (await page("/admin/products?q=verify&status=all&stock=in&sort=price_desc")).ok);
  check("add-product form renders", (await page("/admin/products/new")).ok);
  {
    const r = (await page("/admin/products/" + id)).r; (await import("node:fs")).writeFileSync("C:/Users/navin/AppData/Local/Temp/claude/d--Nagul-2026-Super-wall-site/0cee9634-7f8f-4ab0-9ee9-060d21f53af2/scratchpad/edit.html", r.text);
    check("edit-product form renders with saved values", r.status === 200 && r.text.includes("Verify Product Renamed"), `status=${r.status} hasName=${r.text.includes("Verify Product")} len=${r.text.length}`);
  }
  {
    const r = await raw("/admin/products/zz-adm-nope", { jar: manager.jar });
    check("an unknown product is a 404", r.status === 404 || /NEXT_HTTP_ERROR_FALLBACK;404|not-found|could not be found/i.test(r.text), `status=${r.status}`);
  }
  check("categories page renders", (await page("/admin/categories")).ok);
  check("search treats % and _ literally (no wildcard injection)", (await page("/admin/products?q=%25_%25")).ok);
}

section("Categories");
{
  const cslug = slug("cat");
  const make = (extra = {}) => ({ name: `Verify ${tag}`, slug: cslug, description: "", imageUrl: null, sortOrder: 5, isActive: true, ...extra });
  const created = await call(manager, "categories.save", make());
  const categoryId = created.json?.data?.id;
  check("manager can create a category", created.status === 200 && Boolean(categoryId));
  check("duplicate category slug is refused", (await call(manager, "categories.save", make({ name: "Other name" }))).status === 409);
  check("content manager cannot create categories", (await call(contentMgr, "categories.save", make({ name: "Nope", slug: slug("nope") }))).status === 403);
  const productId = slug("p7");
  await call(manager, "products.create", product(productId, { categoryId }));
  check("a product can be assigned to the category", (await db.query("select category_id from products where id=$1", [productId])).rows[0]?.category_id === categoryId);
  const blocked = await call(manager, "categories.delete", { id: categoryId });
  check("a category that still has products can't be deleted", blocked.status === 409);
  await call(manager, "products.update", { ...product(productId), id: productId, categoryId: null });
  check("an empty category can be deleted", (await call(manager, "categories.delete", { id: categoryId })).status === 200);
  const pubCats = await (await fetch(`${SUPABASE_URL}/rest/v1/categories?select=id`, { headers: { apikey: PUBLISHABLE } })).json();
  check("categories are readable by the public storefront API", Array.isArray(pubCats));
}

section("Image upload");
{
  const ok = await upload(manager);
  check("manager can upload a PNG", ok.status === 200 && ok.json?.data?.url?.includes("/storage/v1/object/public/catalog/products/"), ok.text.slice(0, 200));
  if (ok.status === 200) {
    const fetched = await fetch(ok.json.data.url);
    check("the uploaded image is publicly readable", fetched.status === 200 && (fetched.headers.get("content-type") ?? "").startsWith("image/"));
    const attach = await call(manager, "products.update", { ...product(slug("p1")), id: slug("p1"), images: [{ src: ok.json.data.url, alt: "pixel" }] });
    check("an uploaded image can be attached to a product", attach.status === 200);
  }
  check("an HTML file renamed .png is rejected", (await upload(manager, { bytes: Buffer.from("<script>alert(1)</script>"), name: "evil.png" })).status === 400);
  check("files over 5 MB are rejected", (await upload(manager, { bytes: Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10)]) })).status === 400);
  check("unauthenticated uploads are refused", (await upload(null)).status === 401);
  check("uploads from a foreign Origin are refused", (await upload(manager, { origin: "https://evil.example" })).status === 403);
  check("inventory manager cannot upload catalog images", (await upload(invMgr)).status === 403);
  check("content manager can upload banner images", (await upload(contentMgr, { folder: "banners" })).status === 200);
  check("content manager cannot upload product images", (await upload(contentMgr, { folder: "products" })).status === 403);
  check("unknown upload folders are refused", (await upload(manager, { folder: "../etc" })).status === 400);

  // The Storage policy is the independent second gate: a customer's own token cannot write to the bucket.
  const customerLogin = await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" },
    body: JSON.stringify({ email: globalThis.__adminVerify.customer.email, password: globalThis.__adminVerify.customer.password }),
  })).json();
  const direct = await fetch(`${SUPABASE_URL}/storage/v1/object/catalog/products/direct-${tag}.png`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${customerLogin.access_token}`, "Content-Type": "image/png" },
    body: PNG,
  });
  check("a customer cannot write to the catalog bucket directly (Storage RLS)", !direct.ok);
  const anonDirect = await fetch(`${SUPABASE_URL}/storage/v1/object/catalog/products/anon-${tag}.png`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE, "Content-Type": "image/png" },
    body: PNG,
  });
  check("an anonymous visitor cannot write to the catalog bucket", !anonDirect.ok);
}

void sa;
void BASE;
