import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { PublicBanner } from "@/lib/server/content";
import { cn } from "@/lib/utils";

function BannerCta({ href, label }: { href: string; label: string }) {
  const className = cn(buttonVariants({ variant: "accent", size: "lg" }), "mt-4");
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

/**
 * Homepage banners from the admin panel. Several banners scroll sideways (CSS scroll-snap, no script).
 * Each can have a separate mobile image.
 */
export function HeroBanners({ banners }: { banners: PublicBanner[] }) {
  return (
    <section aria-label="Featured offers" className="px-4 pt-4 sm:px-6 md:pt-8">
      <ul className="mx-auto flex max-w-6xl snap-x snap-mandatory gap-3 overflow-x-auto rounded-3xl [scrollbar-width:none]">
        {banners.map((banner, index) => {
          const desktop = banner.desktopImageUrl ?? banner.mobileImageUrl;
          const mobile = banner.mobileImageUrl ?? banner.desktopImageUrl;
          const Heading = index === 0 ? "h1" : "h2";
          return (
            <li key={banner.id} className="relative aspect-[4/3] w-full shrink-0 snap-center overflow-hidden rounded-3xl bg-brand-blue sm:aspect-[16/7] md:aspect-[16/5]">
              {mobile ? <Image src={mobile} alt="" fill sizes="100vw" priority={index === 0} className="object-cover md:hidden" /> : null}
              {desktop ? <Image src={desktop} alt="" fill sizes="(min-width: 1152px) 1152px, 100vw" priority={index === 0} className="hidden object-cover md:block" /> : null}
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/55 via-black/10 to-transparent p-5 text-white sm:p-8 md:justify-center md:bg-gradient-to-r md:from-black/50 md:to-transparent">
                <div className="max-w-md">
                  <Heading className="text-2xl leading-tight font-extrabold sm:text-4xl">{banner.heading}</Heading>
                  {banner.subtitle ? <p className="mt-2 text-sm text-white/90 sm:text-base">{banner.subtitle}</p> : null}
                  {banner.ctaLabel && banner.ctaHref ? <BannerCta href={banner.ctaHref} label={banner.ctaLabel} /> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
