import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_ACCESS_COOKIE } from "@/lib/admin/cookies";
import type { Permission } from "@/lib/admin/permissions";
import { supabaseConfig } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { enforceRateLimit, handle, json } from "@/lib/server/http";
import { assertSameOrigin } from "@/lib/server/admin/op";
import { writeAudit } from "@/lib/server/admin/audit";
import { CATALOG_BUCKET, MAX_UPLOAD_BYTES, UPLOAD_FOLDERS, publicCatalogPrefix, sniffImage, type UploadFolder } from "@/lib/server/admin/media";
import { requireAdminApi } from "@/lib/server/admin/session";

const FOLDER_PERMISSION: Record<UploadFolder, Permission> = {
  products: "catalog.write",
  categories: "catalog.write",
  banners: "content.write",
  branding: "settings.manage",
};

/**
 * Image upload. The file is validated here (size, real image bytes), then written to Storage with the ADMIN'S OWN
 * session token: Storage's row-level policy `catalog_staff_insert` is the second, independent gate.
 * There is no service-role key anywhere in this flow.
 */
export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_UPLOAD_BYTES + 64_000) throw new ApiError("VALIDATION", "That file is too large (5 MB maximum).");

    const form = await request.formData();
    const folder = String(form.get("folder") ?? "") as UploadFolder;
    if (!UPLOAD_FOLDERS.includes(folder)) throw new ApiError("VALIDATION", "Unknown upload destination.");
    const admin = await requireAdminApi(FOLDER_PERMISSION[folder]);
    await enforceRateLimit("admin-upload", admin.userId, 60, 60);

    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError("VALIDATION", "Choose an image to upload.");
    if (file.size === 0) throw new ApiError("VALIDATION", "That file is empty.");
    if (file.size > MAX_UPLOAD_BYTES) throw new ApiError("VALIDATION", "That file is too large (5 MB maximum).");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type) throw new ApiError("VALIDATION", "Only JPEG, PNG or WebP images can be uploaded.");

    const token = (await cookies()).get(ADMIN_ACCESS_COOKIE)?.value;
    const prefix = publicCatalogPrefix();
    if (!token || !prefix) throw new ApiError("UNAUTHENTICATED", "Please sign in again.");

    const year = new Date().getUTCFullYear();
    const path = `${folder}/${year}/${randomUUID()}.${type.ext}`;
    const { url, key } = supabaseConfig();
    const response = await fetch(`${url}/storage/v1/object/${CATALOG_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`,
        "Content-Type": type.mime,
        "x-upsert": "false",
        "cache-control": "max-age=31536000",
      },
      body: bytes,
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[upload] storage rejected the upload:", response.status);
      throw new ApiError(response.status === 401 || response.status === 403 ? "FORBIDDEN" : "INTERNAL", "The image couldn't be saved. Please try again.");
    }

    await writeAudit(admin, { action: "media.upload", entityType: "media", entityId: path, summary: `Uploaded ${folder} image`, metadata: { bytes: file.size, type: type.mime } });
    return json({ data: { url: `${prefix}${path}`, path } });
  });
}
