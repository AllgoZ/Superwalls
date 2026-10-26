"use client";

import { useState } from "react";
import {
  Bell,
  CircleHelp,
  ClipboardList,
  FileText,
  Info,
  LogIn,
  LogOut,
  MailQuestion,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { WhatsAppLink } from "@/components/common/whatsapp-link";
import { siteConfig } from "@/lib/config/site";
import { dataSource } from "@/lib/services/repositories";
import { useServiceQuery } from "@/lib/hooks/use-service-query";
import { useProfile, useSession } from "@/lib/hooks/use-session";
import { getAddresses } from "@/lib/services/addresses";
import { signIn, signOut } from "@/lib/services/auth";
import { toErrorMessage } from "@/lib/services/errors";
import type { Address } from "@/lib/types";
import { AddressSheet } from "./address-sheet";
import { EditProfileSheet } from "./edit-profile-sheet";
import { SettingsButton, SettingsGroup, SettingsInfo, SettingsLink } from "./settings-list";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ProfileView() {
  const session = useSession();
  const profile = useProfile();
  const addresses = useServiceQuery(getAddresses);

  const [busy, setBusy] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [addressSheet, setAddressSheet] = useState<{ open: boolean; address?: Address }>({ open: false });

  async function run(action: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    try {
      await action();
      toast.success(successMessage);
    } catch (error) {
      toast.error(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (session.status === "loading") return <ListSkeleton rows={4} rowClassName="h-24" />;
  if (session.status === "error") return <ErrorState onRetry={session.reload} />;

  const signedIn = session.data?.signedIn === true;
  const user = profile.data;

  return (
    <div className="space-y-6">
      {/* Account */}
      <section aria-labelledby="account-heading" className="rounded-2xl border bg-white p-4">
        <h2 id="account-heading" className="sr-only">
          Account
        </h2>
        {signedIn && user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-blue text-lg font-bold text-white"
              >
                {initialsOf(user.fullName) || <UserRound className="size-6" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold text-ink">{user.fullName}</p>
                <p className="truncate text-sm text-muted-foreground">{user.email || "No email added"}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {user.mobile ? `+91 ${user.mobile}` : "No mobile number added"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditingProfile(true)}>
                <Pencil aria-hidden />
                Edit profile
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => run(signOut, "Signed out")}
              >
                <LogOut aria-hidden />
                Sign out
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-soft text-muted-foreground"
              >
                <UserRound className="size-6" />
              </span>
              <div>
                <p className="text-lg font-extrabold text-ink">You&apos;re browsing as a guest</p>
                <p className="text-sm text-muted-foreground">
                  Sign in to keep your details handy for faster checkout.
                </p>
              </div>
            </div>
            <Button size="lg" className="w-full" disabled={busy} onClick={() => run(signIn, "Signed in (demo)")}>
              <LogIn aria-hidden />
              Sign in (demo)
            </Button>
          </div>
        )}
        <p className="mt-3 rounded-xl bg-brand-yellow-soft px-3 py-2 text-xs text-ink">
          Demo sign-in only: there is no password and no real account security. Real sign-in arrives with the
          backend integration.
        </p>
      </section>

      {/* Delivery */}
      <SettingsGroup title="Delivery" id="delivery">
        {addresses.status === "success" && addresses.data && addresses.data.length > 0 ? (
          addresses.data.map((address) => (
            <SettingsButton
              key={address.id}
              icon={MapPin}
              label={address.isDefault ? `${address.fullName} · Default` : address.fullName}
              detail={`${address.line1}, ${address.area}, ${address.city} – ${address.pincode}`}
              onClick={() => setAddressSheet({ open: true, address })}
            />
          ))
        ) : (
          <SettingsInfo
            icon={MapPin}
            label="No saved address"
            detail={addresses.status === "loading" ? "Loading…" : "Add one for faster checkout."}
          />
        )}
        <SettingsButton
          icon={Plus}
          label="Add new address"
          onClick={() => setAddressSheet({ open: true })}
        />
      </SettingsGroup>

      {/* Shopping and support */}
      <SettingsGroup title="Shopping and support" id="support">
        <SettingsLink href="/orders" icon={ClipboardList} label="My Orders" detail="Track and review your orders" />
        <SettingsLink href="/help" icon={CircleHelp} label="Help and Support" detail="Answers to common questions" />
        <SettingsLink href="/help#contact" icon={MailQuestion} label="Contact Us" />
        <SettingsLink href="/help#faq" icon={Info} label="Frequently Asked Questions" />
        <li className="flex min-h-14 items-center px-4 py-2">
          <WhatsAppLink className="-ml-3" />
        </li>
      </SettingsGroup>

      {/* Preferences and information */}
      <SettingsGroup title="Preferences and information" id="info">
        <SettingsInfo
          icon={Bell}
          label="Notification preferences"
          detail="Order updates and offers"
          trailing={
            <span className="rounded-full bg-soft px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              Coming soon
            </span>
          }
        />
        <SettingsLink href="/privacy" icon={ShieldCheck} label="Privacy Policy" />
        <SettingsLink href="/terms" icon={FileText} label="Terms and Conditions" />
        <SettingsInfo
          icon={Info}
          label="Version"
          detail={`${siteConfig.name} ${siteConfig.version} · ${dataSource.mode === "demo" ? "Demo mode" : "Live"}${
            dataSource.credentialsDetectedButUnused ? " (Supabase keys found, not yet connected)" : ""
          }`}
        />
      </SettingsGroup>

      {user ? (
        <EditProfileSheet open={editingProfile} onOpenChange={setEditingProfile} profile={user} />
      ) : null}
      <AddressSheet
        key={addressSheet.address?.id ?? "new"}
        open={addressSheet.open}
        onOpenChange={(open) => setAddressSheet((current) => ({ ...current, open }))}
        address={addressSheet.address}
      />
    </div>
  );
}
