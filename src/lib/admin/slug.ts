export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "Floor Cleaner 1 L!" -> "floor-cleaner-1-l". */
export function slugify(input: string, maxLength = 60): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}
