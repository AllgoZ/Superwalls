"use client";

import { useState } from "react";
import { ProductImage } from "@/components/common/product-image";
import { cn } from "@/lib/utils";
import type { ProductImage as ProductImageData } from "@/lib/types";

/** Primary image, with a thumbnail strip only when the product has more than one image. */
export function ProductGallery({ images, name }: { images: ProductImageData[]; name: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  return (
    <div className="space-y-3">
      <ProductImage
        src={active?.src}
        alt={active?.alt ?? name}
        sizes="(min-width: 768px) 50vw, 100vw"
        priority
        className="md:rounded-3xl"
      />
      {images.length > 1 ? (
        <ul className="flex gap-2 px-4 md:px-0" aria-label="Product images">
          {images.map((image, index) => (
            <li key={image.src}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-current={index === activeIndex}
                className={cn(
                  "block w-16 overflow-hidden rounded-xl border-2 transition-colors",
                  index === activeIndex ? "border-brand-blue" : "border-transparent",
                )}
              >
                <ProductImage src={image.src} alt="" sizes="64px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
