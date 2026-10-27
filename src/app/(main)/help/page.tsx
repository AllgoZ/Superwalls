import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { WhatsAppLink } from "@/components/common/whatsapp-link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { resolveSupport } from "@/lib/config/support";
import { getActiveFaqs, getPublicSettings, type PublicFaq } from "@/lib/server/content";

export const metadata: Metadata = { title: "Help & Support" };

/** Shown only if the FAQ list can't be loaded at all (for example when running without a database). */
const FALLBACK_FAQS: PublicFaq[] = [
  { id: "f1", category: "Orders", question: "How do I place an order?", answer: "Add products to your cart and check out as a guest or with an account. There are three steps: delivery details, review and online payment, then confirmation once your payment is verified." },
  { id: "f2", category: "Orders", question: "How can I track my order?", answer: "Signed in: open the Orders tab. Guest: use the private tracking link shown after you pay, or the Track page with your order number and tracking code." },
  { id: "f3", category: "Payments", question: "Which payment methods are available?", answer: "We accept online payment only (no Cash on Delivery). Your order is confirmed once the payment is verified." },
];

async function Faqs() {
  const faqs = (await getActiveFaqs()) ?? FALLBACK_FAQS;
  if (faqs.length === 0) return null;
  const categories = [...new Set(faqs.map((faq) => faq.category))];

  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-header">
      <h2 id="faq-heading" className="mb-2 text-lg font-bold text-ink">
        Frequently asked questions
      </h2>
      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category}>
            {categories.length > 1 ? <h3 className="mb-1.5 text-sm font-bold text-muted-foreground">{category}</h3> : null}
            <Accordion className="rounded-2xl border bg-white px-4">
              {faqs
                .filter((faq) => faq.category === category)
                .map((item) => (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger className="py-4 text-sm font-semibold text-ink">{item.question}</AccordionTrigger>
                    <AccordionContent className="text-sm whitespace-pre-line text-muted-foreground">{item.answer}</AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </div>
        ))}
      </div>
    </section>
  );
}

async function Contact() {
  const { contact } = await getPublicSettings();
  const support = resolveSupport(contact);
  return (
    <section id="contact" aria-labelledby="contact-heading" className="scroll-mt-header">
      <h2 id="contact-heading" className="mb-2 text-lg font-bold text-ink">
        Contact us
      </h2>
      <div className="space-y-3 rounded-2xl border bg-white p-4">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink">WhatsApp</p>
            <WhatsAppLink />
            {support.isWhatsappPlaceholder ? <p className="text-xs text-muted-foreground">The business WhatsApp number has not been configured yet.</p> : null}
          </div>
        </div>
        {support.supportPhone ? (
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-ink">Phone</p>
              <a href={`tel:${support.supportPhone.replace(/\s+/g, "")}`} className="text-sm font-medium text-brand-blue hover:underline">
                {support.supportPhone}
              </a>
            </div>
          </div>
        ) : null}
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-ink">Email</p>
            {support.supportEmail ? (
              <a href={`mailto:${support.supportEmail}`} className="text-sm font-medium text-brand-blue hover:underline">
                {support.supportEmail}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Support email will be added soon.</p>
            )}
          </div>
        </div>
        {support.availability ? <p className="border-t pt-3 text-xs text-muted-foreground">{support.availability}</p> : null}
      </div>
    </section>
  );
}

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-5 sm:px-6 md:pt-8">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Help &amp; Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quick answers, and how to reach us.</p>
      </div>

      <Faqs />
      <Contact />

      <p className="text-sm text-muted-foreground">
        Looking for an order?{" "}
        <Link href="/orders" className="font-semibold text-brand-blue hover:underline">
          Go to My Orders
        </Link>
      </p>
    </div>
  );
}
