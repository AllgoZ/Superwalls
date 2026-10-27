"use client";

import { createContext, useContext, type ReactNode } from "react";
import { resolveSupport, type SupportInfo } from "@/lib/config/support";

const SupportContext = createContext<SupportInfo | null>(null);

/** Supplies the (admin-managed) support contact details to client components such as the WhatsApp link. */
export function SupportProvider({ value, children }: { value: SupportInfo; children: ReactNode }) {
  return <SupportContext value={value}>{children}</SupportContext>;
}

export function useSupport(): SupportInfo {
  return useContext(SupportContext) ?? resolveSupport();
}
