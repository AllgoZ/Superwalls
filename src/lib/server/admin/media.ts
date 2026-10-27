import "server-only";
import { ApiError } from "../errors";

export const CATALOG_BUCKET = "catalog";
export const UPLOAD_FOLDERS = ["products", "banners", "categories", "branding"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function publicCatalogPrefix(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  return base ? `${base}/storage/v1/object/public/${CATALOG_BUCKET}/` : null;
}

/**
 * Image references are stored as plain strings, so they are checked before they reach the database:
 * only our own public bucket or the storefront's bundled /products assets. This keeps the catalog from being
 * pointed at arbitrary third-party hosts (tracking pixels, mixed content, hot-linked files).
 */
export function assertAllowedImageUrl(src: string): void {
  const prefix = publicCatalogPrefix();
  const ok =
    (prefix !== null && src.startsWith(prefix) && !src.includes("..") && !src.includes("?")) ||
    (/^\/products\/[\w.-]+$/.test(src));
  if (!ok) throw new ApiError("VALIDATION", "Images must be uploaded through the admin panel.");
}

export function assertAllowedImageUrls(images: { src: string }[]): void {
  for (const image of images) assertAllowedImageUrl(image.src);
}

/** Identifies an image by its first bytes, so a renamed .exe or HTML file cannot pass as a picture. */
export function sniffImage(bytes: Uint8Array): { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}
