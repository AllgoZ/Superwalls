import "server-only";

/** Next.js `searchParams` after `await`. */
export type SearchParams = Record<string, string | string[] | undefined>;

export function param(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  const single = Array.isArray(value) ? value[0] : value;
  const trimmed = single?.trim();
  return trimmed ? trimmed : undefined;
}

export const PAGE_SIZE = 20;

export function pageParams(searchParams: SearchParams, pageSize = PAGE_SIZE) {
  const raw = Number(param(searchParams, "page") ?? 1);
  const page = Number.isInteger(raw) && raw >= 1 && raw <= 100_000 ? raw : 1;
  return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Builds an ILIKE pattern from user text, escaping the wildcard characters so they match literally. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** A calendar date (YYYY-MM-DD) or undefined. Anything else is ignored rather than passed to SQL. */
export function dateParam(searchParams: SearchParams, key: string): string | undefined {
  const value = param(searchParams, key);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
}
