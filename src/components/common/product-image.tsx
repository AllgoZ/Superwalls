"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src?: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}

/** Square product image with a graceful fallback when the image is missing or fails to load. */
export function ProductImage({ src, alt, sizes, priority, className }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;

  return (
    <div className={cn("relative aspect-square overflow-hidden bg-soft", className)}>
      {failed ? (
        <div
          role="img"
          aria-label={alt}
          className="flex size-full items-center justify-center text-muted-foreground"
        >
          <ImageOff className="size-8" aria-hidden />
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={src.endsWith(".svg")}
          onError={() => setFailedSrc(src)}
          className="object-cover"
        />
      )}
    </div>
  );
}
