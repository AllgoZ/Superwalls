import Image from "next/image";
import { cn } from "@/lib/utils";

/** Official logo assets (cropped from reference/logo.jpeg) in /public/brand. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo-mark.png"
      alt=""
      width={345}
      height={407}
      priority
      className={cn("h-9 w-auto", className)}
    />
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo-wordmark.png"
      alt="SuperWalls"
      width={661}
      height={138}
      priority
      className={cn("h-6 w-auto", className)}
    />
  );
}

/** Mark + wordmark lockup used in headers. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <LogoWordmark />
    </span>
  );
}

/** Full lockup including the tagline, for larger placements. */
export function LogoFull({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo-full.png"
      alt="SuperWalls – Cleaner Homes, Happy Life"
      width={661}
      height={584}
      className={cn("h-40 w-auto", className)}
    />
  );
}
