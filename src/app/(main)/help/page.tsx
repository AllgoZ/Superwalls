import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { WhatsAppLink } from "@/components/common/whatsapp-link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supportConfig } from "@/lib/config/support";

export const metadata: Metadata = { title: "Help & Support" };

/** Placeholder answers. Replace with real policies once the business confirms them. */
const FAQS = [
  {
    q: "How do I place an order?",
    a: "Add products to your cart, open the cart, and follow the three checkout steps: delivery details, review and payment, then confirmation.",
  },
  {
    q: "How can I track my order?",
    a: "Open the Orders tab. Each order shows its current status and a timeline. Live tracking updates arrive with the backend integration.",
  },
  {
    q: "Which payment methods are available?",
    a: "Cash on Delivery is available in this demo. Online payment is not available yet; final payment options will be confirmed by SuperWalls.",
  },
  {
    q: "What are the delivery charges?",
    a: "Delivery charges and free-delivery rules shown in the demo are placeholders. The real policy will be confirmed by SuperWalls.",
  },
  {
    q: "Can I change or cancel an order?",
    a: "Order changes are not available in the app yet. Please contact support with your order number.",
  },
] as const;

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-5 sm:px-6 md:pt-8">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Help &amp; Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quick answers, and how to reach us.
        </p>
      </div>

      <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-header">
        <h2 id="faq-heading" className="mb-2 text-lg font-bold text-ink">
          Frequently asked questions
        </h2>
        <Accordion className="rounded-2xl border bg-white px-4">
          {FAQS.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="py-4 text-sm font-semibold text-ink">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

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
              {supportConfig.isWhatsappPlaceholder ? (
                <p className="text-xs text-muted-foreground">
                  The business WhatsApp number has not been configured yet.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-ink">Email</p>
              {supportConfig.supportEmail ? (
                <a
                  href={`mailto:${supportConfig.supportEmail}`}
                  className="text-sm font-medium text-brand-blue hover:underline"
                >
                  {supportConfig.supportEmail}
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">Support email will be added soon.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        Looking for an order?{" "}
        <Link href="/orders" className="font-semibold text-brand-blue hover:underline">
          Go to My Orders
        </Link>
      </p>
    </div>
  );
}
