import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils";
import { Greeting } from "./greeting";

function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("fill-brand-yellow", className)}>
      <path d="M20 0 Q23 17 40 20 Q23 23 20 40 Q17 23 0 20 Q17 17 20 0Z" />
    </svg>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="px-4 pt-4 sm:px-6 md:pt-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-brand-blue px-5 py-7 text-white sm:px-10 sm:py-12 md:py-16">
        <Sparkle className="absolute -top-2 right-6 size-16 opacity-90 sm:right-24 sm:size-24 md:right-8 md:size-20" />
        <Sparkle className="absolute right-20 bottom-5 size-8 opacity-90 sm:right-48 sm:bottom-10 sm:size-12" />
        <Sparkle className="absolute right-3 bottom-14 size-5 opacity-60 sm:right-10 sm:size-7" />

        <div
          aria-hidden
          className="absolute top-1/2 right-16 hidden size-56 -translate-y-1/2 items-center justify-center rounded-[2.5rem] bg-white md:flex lg:right-28"
        >
          <LogoMark className="h-40" />
        </div>

        <div className="relative max-w-md">
          <Greeting />
          <h1
            id="hero-heading"
            className="mt-2 text-[1.75rem] leading-tight font-extrabold tracking-tight sm:text-4xl md:text-5xl"
          >
            A cleaner home starts here.
          </h1>
          <p className="mt-3 text-sm text-white/90 sm:text-base">
            {siteConfig.tagline}. Pick your essentials and order in a few taps.
          </p>
          <a
            href="#products"
            className={cn(buttonVariants({ variant: "accent", size: "lg" }), "mt-6")}
          >
            Shop Products
          </a>
        </div>
      </div>
    </section>
  );
}
