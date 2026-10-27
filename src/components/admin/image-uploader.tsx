"use client";

import Image from "next/image";
import { useRef, useState, type DragEvent } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, RefreshCw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminUpload, errorMessage } from "@/lib/admin/client";
import { cn } from "@/lib/utils";

export interface ImageItem {
  src: string;
  alt: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Upload, preview, reorder, replace and remove images. The first image is the primary one.
 * Client checks are for fast feedback only; the server re-validates size and the real file type.
 */
export function ImageUploader({
  images,
  onChange,
  folder,
  max = 10,
  single = false,
  label = "Images",
}: {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  folder: "products" | "banners" | "categories" | "branding";
  max?: number;
  single?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const replaceIndex = useRef<number | null>(null);
  const [busy, setBusy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const limit = single ? 1 : max;

  async function upload(files: File[]) {
    const replacing = replaceIndex.current;
    replaceIndex.current = null;
    const room = replacing !== null ? 1 : limit - images.length;
    if (room <= 0) {
      toast.error(`You can add up to ${limit} image${limit === 1 ? "" : "s"}.`);
      return;
    }
    const accepted: File[] = [];
    for (const file of files.slice(0, room)) {
      if (!TYPES.includes(file.type)) toast.error(`${file.name}: use a JPEG, PNG or WebP image.`);
      else if (file.size > MAX_BYTES) toast.error(`${file.name}: images must be 5 MB or smaller.`);
      else accepted.push(file);
    }
    if (accepted.length === 0) return;

    setBusy((n) => n + accepted.length);
    const uploaded: ImageItem[] = [];
    for (const file of accepted) {
      try {
        const { url } = await adminUpload(file, folder);
        uploaded.push({ src: url, alt: "" });
      } catch (error) {
        toast.error(`${file.name}: ${errorMessage(error)}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (uploaded.length === 0) return;
    if (replacing !== null) {
      onChange(images.map((image, index) => (index === replacing ? { ...uploaded[0]!, alt: image.alt } : image)));
    } else {
      onChange(single ? uploaded.slice(0, 1) : [...images, ...uploaded]);
    }
  }

  function pick(files: FileList | null) {
    if (files && files.length > 0) void upload([...files]);
    if (input.current) input.current.value = "";
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void upload([...event.dataTransfer.files]);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <input ref={input} type="file" accept={TYPES.join(",")} multiple={!single} className="sr-only" onChange={(event) => pick(event.target.files)} aria-label={label} />
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={`${image.src}-${index}`} className="overflow-hidden rounded-lg border bg-white">
              <div className="relative aspect-square bg-muted">
                <Image src={image.src} alt={image.alt || `Image ${index + 1}`} fill unoptimized sizes="200px" className="object-cover" />
                {index === 0 && !single ? (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-brand-yellow px-2 py-0.5 text-[0.65rem] font-extrabold text-ink">
                    <Star className="size-3" aria-hidden /> Primary
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-0.5 p-1.5">
                {!single ? (
                  <>
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move earlier">
                      <ArrowLeft aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => move(index, 1)} disabled={index === images.length - 1} aria-label="Move later">
                      <ArrowRight aria-hidden />
                    </Button>
                    {index !== 0 ? (
                      <Button type="button" variant="ghost" size="icon-xs" onClick={() => onChange([image, ...images.filter((_, i) => i !== index)])} aria-label="Make primary" title="Make primary">
                        <Star aria-hidden />
                      </Button>
                    ) : null}
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    replaceIndex.current = index;
                    input.current?.click();
                  }}
                  aria-label="Replace image"
                  title="Replace"
                >
                  <RefreshCw aria-hidden />
                </Button>
                <Button type="button" variant="ghost" size="icon-xs" className="ml-auto text-danger" onClick={() => onChange(images.filter((_, i) => i !== index))} aria-label="Remove image">
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <input
                value={image.alt}
                onChange={(event) => onChange(images.map((item, i) => (i === index ? { ...item, alt: event.target.value.slice(0, 160) } : item)))}
                placeholder="Alt text (describe the image)"
                aria-label={`Alt text for image ${index + 1}`}
                className="w-full border-t px-2 py-1.5 text-xs outline-none focus:bg-brand-blue-soft"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {images.length < limit ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center", dragging ? "border-primary bg-brand-blue-soft" : "bg-muted/40")}
        >
          {busy > 0 ? <Loader2 className="size-6 animate-spin text-primary" aria-hidden /> : <ImagePlus className="size-6 text-muted-foreground" aria-hidden />}
          <p className="text-sm text-muted-foreground">
            {busy > 0 ? `Uploading ${busy} image${busy === 1 ? "" : "s"}…` : "Drag images here, or choose files"}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy > 0}>
            Choose {single ? "image" : "images"}
          </Button>
          <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 5 MB each{single ? "" : `, ${limit} max`}.</p>
        </div>
      ) : null}
    </div>
  );
}
