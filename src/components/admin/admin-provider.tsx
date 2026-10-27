"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AdminSummary, Permission } from "@/lib/admin/permissions";

const AdminContext = createContext<AdminSummary | null>(null);

export function AdminProvider({ admin, children }: { admin: AdminSummary; children: ReactNode }) {
  return <AdminContext value={admin}>{children}</AdminContext>;
}

export function useAdmin(): AdminSummary {
  const admin = useContext(AdminContext);
  if (!admin) throw new Error("useAdmin must be used inside <AdminProvider>.");
  return admin;
}

export function useCan(permission: Permission): boolean {
  return useAdmin().permissions.includes(permission);
}

/**
 * Shows its children only to admins holding the permission. This is presentation only: the server rejects the
 * underlying operation for anyone without it, whatever the browser renders.
 */
export function PermissionGuard({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useCan(permission) ? <>{children}</> : <>{fallback}</>;
}
