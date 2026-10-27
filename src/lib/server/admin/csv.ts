import "server-only";

/**
 * Spreadsheet programs run cells that start with = + - @ (or tab / CR) as formulas, which lets customer-typed
 * text such as a delivery note execute on whoever opens the export. Prefixing an apostrophe neutralises it.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // A byte-order mark makes Excel read UTF-8 (₹, Indian names) correctly.
  return `﻿${[headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

export const rupees = (paise: number | string | null | undefined): string => {
  const n = Number(paise ?? 0);
  return `${Math.trunc(n / 100)}.${String(Math.abs(n) % 100).padStart(2, "0")}`;
};
