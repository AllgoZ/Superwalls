import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuthSync } from "@/components/auth/auth-sync";
import { CartHydrator } from "@/components/cart/cart-hydrator";
import { SupportProvider } from "@/components/common/support-provider";
import { Toaster } from "@/components/ui/sonner";
import { resolveSupport } from "@/lib/config/support";
import { getPublicSettings } from "@/lib/server/content";
import { siteConfig } from "@/lib/config/site";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} – ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0654b4",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Cached and tagged: edits to Settings > Contact reach every page without a redeploy.
  const { contact } = await getPublicSettings();
  const support = resolveSupport(contact);
  return (
    <html lang="en" className={`${plusJakarta.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-white font-sans text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-brand-blue focus:shadow-lg"
        >
          Skip to content
        </a>
        <CartHydrator />
        <AuthSync />
        <SupportProvider value={support}>{children}</SupportProvider>
        <Toaster position="top-center" closeButton />
      </body>
    </html>
  );
}
