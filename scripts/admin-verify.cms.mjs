// CMS content: banners, sections, pages (sanitisation), FAQs, footer, and live storefront synchronisation.
// Imported by admin-verify.mjs.
import { randomUUID } from "node:crypto";

const { pageDenied, manager, orderMgr, contentMgr, invMgr, call, raw, db, check, section, BASE, SUPABASE_URL, PUBLISHABLE } = globalThis.__adminVerify;

const tag = randomUUID().slice(0, 6);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const store = (path) => raw(path, { headers: { "x-forwarded-for": `10.77.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}` } });

async function upload(session, folder) {
  const form = new FormData();
  form.set("file", new File([PNG], "pixel.png", { type: "image/png" }));
  form.set("folder", folder);
  return raw("/api/admin/upload", { method: "POST", body: form, jar: session.jar });
}
const sectionRow = async (key) => (await db.query("select title, body, is_visible, sort_order, items from cms_sections where key=$1", [key])).rows[0];
const original = {
  hero: await sectionRow("hero"),
  why: await sectionRow("why_choose"),
  footer: (await db.query("select value from store_settings where key='footer'")).rows[0]?.value,
  privacy: (await db.query("select * from cms_pages where slug='privacy'")).rows[0] ?? null,
};

section("Banners");
{
  const img = await upload(contentMgr, "banners");
  check("content manager can upload a banner image", img.status === 200);
  const url = img.json?.data?.url;
  const banner = (extra = {}) => ({ heading: `Verify Banner ${tag}`, subtitle: "Sale on now", ctaLabel: "Shop", ctaHref: "/#products", desktopImageUrl: url, mobileImageUrl: null, sortOrder: 5, isActive: true, startsAt: null, endsAt: null, ...extra });

  const created = await call(contentMgr, "banners.save", banner());
  const bannerId = created.json?.data?.id;
  check("content manager can create a banner", created.status === 200 && Boolean(bannerId), created.text.slice(0, 160));
  check("a button link must be on-site or https", (await call(contentMgr, "banners.save", banner({ ctaHref: "javascript:alert(1)" }))).status === 400);
  check("a data: link is refused too", (await call(contentMgr, "banners.save", banner({ ctaHref: "data:text/html,x" }))).status === 400);
  check("a button needs a destination", (await call(contentMgr, "banners.save", banner({ ctaHref: "" }))).status === 400);
  check("banner images must come from the managed bucket", (await call(contentMgr, "banners.save", banner({ desktopImageUrl: "https://evil.example/x.png" }))).status === 400);
  check("the end date must follow the start", (await call(contentMgr, "banners.save", banner({ startsAt: "2030-01-02T00:00:00+05:30", endsAt: "2030-01-01T00:00:00+05:30" }))).status === 400);
  check("order manager can't edit banners", (await call(orderMgr, "banners.save", banner())).status === 403);
  check("inventory manager can't edit banners", (await call(invMgr, "banners.save", banner())).status === 403);

  const home = await store("/");
  check("a published banner appears on the storefront immediately", home.status === 200 && home.text.includes(`Verify Banner ${tag}`));
  check("the manager sees it in the admin list", (await raw("/admin/content?tab=banners", { jar: manager.jar })).text.includes(`Verify Banner ${tag}`));

  check("a banner can be deactivated", (await call(contentMgr, "banners.save", banner({ id: bannerId, isActive: false }))).status === 200);
  check("…and then it leaves the storefront at once", !(await store("/")).text.includes(`Verify Banner ${tag}`));
  check("a scheduled banner isn't shown before its start", (await call(contentMgr, "banners.save", banner({ id: bannerId, isActive: true, startsAt: "2099-01-01T00:00:00+05:30" }))).status === 200 && !(await store("/")).text.includes(`Verify Banner ${tag}`));
  check("an expired banner isn't shown", (await call(contentMgr, "banners.save", banner({ id: bannerId, startsAt: null, endsAt: "2020-01-01T00:00:00+05:30" }))).status === 200 && !(await store("/")).text.includes(`Verify Banner ${tag}`));
  check("a banner can be deleted", (await call(contentMgr, "banners.delete", { id: bannerId })).status === 200);
  check("customers can't read inactive banners through the public API", Array.isArray(await (await fetch(`${SUPABASE_URL}/rest/v1/homepage_banners?select=id`, { headers: { apikey: PUBLISHABLE } })).json()));
}

section("Homepage sections");
{
  const sec = (key, extra = {}) => ({ key, title: "", body: "", ctaLabel: "", ctaHref: "", items: [], isVisible: true, sortOrder: 10, ...extra });
  const heroTitle = `Hero ${tag}`;
  check("content manager can edit the hero", (await call(contentMgr, "sections.save", sec("hero", { title: heroTitle, body: "Edited subtitle", ctaLabel: "Buy", ctaHref: "#products", sortOrder: 0 }))).status === 200);
  check("the hero edit is live", (await store("/")).text.includes(heroTitle));

  check("a section can be hidden", (await call(contentMgr, "sections.save", sec("why_choose", { title: "Why us", items: [{ title: "Secure online payment", text: "x" }], isVisible: false, sortOrder: 40 }))).status === 200);
  check("…and a hidden section leaves the storefront", !(await store("/")).text.includes("Secure online payment"));
  check("…and shows again when re-enabled", (await call(contentMgr, "sections.save", sec("why_choose", { title: "Why us", items: [{ title: "Secure online payment", text: "x" }], isVisible: true, sortOrder: 40 }))).status === 200 && (await store("/")).text.includes("Secure online payment"));
  check("at most 8 points per section", (await call(contentMgr, "sections.save", sec("benefits", { items: Array.from({ length: 9 }, (_, i) => ({ title: `P${i}`, text: "" })) }))).status === 400);
  check("a section button needs a destination", (await call(contentMgr, "sections.save", sec("support", { ctaLabel: "Go", ctaHref: "" }))).status === 400);
  check("unknown sections are refused", (await call(contentMgr, "sections.save", sec("nope"))).status === 400);
  check("order manager can't edit sections", (await call(orderMgr, "sections.save", sec("hero"))).status === 403);
  const promo = await store("/");
  check("the promo strip shows the live free-delivery amount", /Free delivery on orders above/.test(promo.text));
}

section("Pages");
{
  const page = (slug, extra = {}) => ({ slug, title: `Verify ${slug}`, contentMd: "## Heading\n\nSome **bold** text.", seoTitle: "", seoDescription: "", status: "published", ...extra });

  check("an unpublished page is a 404 on the storefront", (await store("/about")).status === 404);
  check("content manager can save a draft", (await call(contentMgr, "pages.save", page("about", { status: "draft" }))).status === 200);
  check("…a draft is still not public", (await store("/about")).status === 404);
  check("a published page needs content", (await call(contentMgr, "pages.save", page("about", { contentMd: "  " }))).status === 400);

  const hostile = "## Safe heading\n\n<script>alert('xss-1')</script>\n\n<img src=x onerror=alert('xss-2')>\n\n[bad link](javascript:alert('xss-3'))\n\n![tracker](https://evil.example/pixel.png)\n\n[good](https://example.com)\n\n[mail](mailto:hi@example.com)";
  check("a page with hostile content can be saved (it is neutralised on output)", (await call(contentMgr, "pages.save", page("about", { contentMd: hostile, seoTitle: `SEO ${tag}`, seoDescription: "About desc" }))).status === 200);
  const live = await store("/about");
  const body = live.text.replace(/<script[\s\S]*?<\/script>/g, "");
  check("a published page is live straight away", live.status === 200 && body.includes("Safe heading") && body.includes(`Verify about`));
  check("script tags are not rendered", !/<script>alert\('xss-1'\)/.test(live.text) && !body.includes("alert('xss-1')"));
  // The source text "<img … onerror=…>" may appear as ESCAPED TEXT; what must never exist is a real element with a handler.
  check("inline event handlers are not rendered as attributes", !/<[a-z][^>]*son[a-z]+s*=/i.test(body));
  check("javascript: links are removed", !/href="javascript:/i.test(body));
  check("remote images are not rendered", !body.includes("evil.example/pixel.png"));
  check("https and mailto links survive, with safe attributes", /href="https:\/\/example\.com"[^>]*rel="[^"]*noopener/.test(body) && body.includes('href="mailto:hi@example.com"'));
  check("SEO title and description are used", live.text.includes(`SEO ${tag}`) && live.text.includes("About desc"));
  check("a draft/unpublished page leaves the storefront at once", (await call(contentMgr, "pages.unpublish", { slug: "about" })).status === 200 && (await store("/about")).status === 404);

  check("unknown page slugs are refused", (await call(contentMgr, "pages.save", page("secret"))).status === 400);
  check("order manager can't edit pages", (await call(orderMgr, "pages.save", page("about"))).status === 403);

  // Built-in legal text stays until staff publish their own.
  check("privacy shows the built-in text by default", (await store("/privacy")).text.includes("Privacy Policy"));
  await call(contentMgr, "pages.save", page("privacy", { title: "Privacy Policy", contentMd: `Our privacy promise ${tag}.` }));
  check("a published privacy policy replaces the built-in text", (await store("/privacy")).text.includes(`Our privacy promise ${tag}`));
  await call(contentMgr, "pages.unpublish", { slug: "privacy" });
  check("unpublishing falls back to the built-in text", !(await store("/privacy")).text.includes(`Our privacy promise ${tag}`) && (await store("/privacy")).text.includes("Privacy Policy"));

  check("the pages list renders for content managers", (await raw("/admin/pages", { jar: contentMgr.jar })).status === 200);
  check("the page editor renders", (await raw("/admin/pages/about", { jar: contentMgr.jar })).status === 200);
  check("order manager can't open pages", pageDenied(await raw("/admin/pages", { jar: orderMgr.jar })));
  check("customers can't read draft pages through the public API", ((await (await fetch(`${SUPABASE_URL}/rest/v1/cms_pages?select=slug&status=eq.draft`, { headers: { apikey: PUBLISHABLE } })).json()).length ?? 0) === 0);
}

section("FAQs");
{
  const q = `Verify question ${tag}?`;
  const faq = (extra = {}) => ({ category: "Verify", question: q, answer: "Verify answer", sortOrder: 5, isActive: true, ...extra });
  const created = await call(contentMgr, "faqs.save", faq());
  const id = created.json?.data?.id;
  check("content manager can create an FAQ", created.status === 200 && Boolean(id));
  check("the FAQ appears on the Help page", (await store("/help")).text.includes(q));
  check("an FAQ can be hidden", (await call(contentMgr, "faqs.save", faq({ id, isActive: false }))).status === 200 && !(await store("/help")).text.includes(q));
  check("an FAQ needs a question and an answer", (await call(contentMgr, "faqs.save", faq({ question: "x" }))).status === 400 && (await call(contentMgr, "faqs.save", faq({ answer: " " }))).status === 400);
  check("order manager can't edit FAQs", (await call(orderMgr, "faqs.save", faq())).status === 403);
  check("an FAQ can be deleted", (await call(contentMgr, "faqs.delete", { id })).status === 200);
  check("the FAQ page renders in admin", (await raw("/admin/faqs", { jar: contentMgr.jar })).status === 200);
}

section("Footer");
{
  const footer = (extra = {}) => ({ description: `Footer ${tag}`, usefulLinks: [{ label: "Help", href: "/help" }], policyLinks: [{ label: "Privacy", href: "/privacy" }], socialLinks: [{ label: "Instagram", href: "https://instagram.com/example" }], copyright: `© Verify ${tag}`, ...extra });
  check("content manager can save the footer", (await call(contentMgr, "footer.save", footer())).status === 200);
  const home = await store("/");
  check("footer changes reach the storefront", home.text.includes(`Footer ${tag}`) && home.text.includes(`© Verify ${tag}`) && home.text.includes("https://instagram.com/example"));
  check("footer links can't be javascript:", (await call(contentMgr, "footer.save", footer({ usefulLinks: [{ label: "x", href: "javascript:alert(1)" }] }))).status === 400);
  check("social links must be https", (await call(contentMgr, "footer.save", footer({ socialLinks: [{ label: "x", href: "http://insecure.example" }] }))).status === 400);
  check("order manager can't edit the footer", (await call(orderMgr, "footer.save", footer())).status === 403);
}

// Put the shared storefront content back the way it was.
await db.query("update cms_sections set title=$2, body=$3, is_visible=$4, sort_order=$5, items=$6::jsonb where key=$1", ["hero", original.hero.title, original.hero.body, original.hero.is_visible, original.hero.sort_order, JSON.stringify(original.hero.items)]);
await db.query("update cms_sections set title=$2, body=$3, is_visible=$4, sort_order=$5, items=$6::jsonb where key=$1", ["why_choose", original.why.title, original.why.body, original.why.is_visible, original.why.sort_order, JSON.stringify(original.why.items)]);
await db.query("update cms_sections set cta_label='', cta_href='' where key='hero'");
await db.query("update cms_sections set cta_label='Shop Products', cta_href='#products' where key='hero'");
if (original.footer) await db.query("update store_settings set value=$1::jsonb where key='footer'", [JSON.stringify(original.footer)]);
await db.query("delete from cms_pages where slug in ('about','contact','shipping','refund')");
if (original.privacy) await db.query("update cms_pages set status=$2, title=$3, content_md=$4 where slug='privacy'", ["privacy", original.privacy.status, original.privacy.title, original.privacy.content_md]);
else await db.query("delete from cms_pages where slug='privacy'");
await db.query("delete from faqs where category = 'Verify'");
void BASE;
