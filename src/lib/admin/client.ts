/** Browser-side access to admin mutations. The server re-checks identity, permission and input on every call. */
export class AdminApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.code = code;
    this.status = status;
  }
}

async function parse<T>(response: Response): Promise<T> {
  let body: { data?: T; error?: { code?: string; message?: string } } | null = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON response (e.g. a proxy error page).
  }
  if (!response.ok || !body || body.error) {
    const code = body?.error?.code ?? "UNKNOWN";
    // An expired or revoked session: send the person to sign in again instead of showing a cryptic toast.
    if (response.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
      // A full reload on purpose: it also clears any stale client state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new AdminApiError(code, body?.error?.message ?? "Something went wrong. Please try again.", response.status);
  }
  return body.data as T;
}

/** Runs a registered admin operation (`src/lib/server/admin/ops`). */
export async function adminCall<T = unknown>(name: string, input: unknown = {}): Promise<T> {
  const response = await fetch(`/api/admin/op/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "same-origin",
  });
  return parse<T>(response);
}

export async function adminUpload(file: File, folder: "products" | "banners" | "categories" | "branding"): Promise<{ url: string; path: string }> {
  const form = new FormData();
  form.set("file", file);
  form.set("folder", folder);
  const response = await fetch("/api/admin/upload", { method: "POST", body: form, credentials: "same-origin" });
  return parse<{ url: string; path: string }>(response);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
