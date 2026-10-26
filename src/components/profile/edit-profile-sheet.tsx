"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FormField } from "@/components/common/form-field";
import { toErrorMessage } from "@/lib/services/errors";
import { updateProfile } from "@/lib/services/profile";
import type { CustomerProfile } from "@/lib/types";
import { normalizeMobile, profileSchema, type ProfileFormValues } from "@/lib/validation/schemas";

function ProfileForm({ profile, onDone }: { profile: CustomerProfile; onDone: () => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile.fullName,
      email: profile.email ?? "",
      mobile: profile.mobile ?? "",
    },
    mode: "onTouched",
  });

  async function onSubmit(values: ProfileFormValues) {
    try {
      await updateProfile({
        fullName: values.fullName,
        email: values.email || undefined,
        mobile: values.mobile || undefined,
      });
      toast.success("Profile updated");
      onDone();
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 px-4 pb-6">
      <FormField id="profile-name" label="Full name" error={errors.fullName?.message}>
        {(control) => <Input {...control} autoComplete="name" {...register("fullName")} />}
      </FormField>
      <FormField id="profile-email" label="Email" optional error={errors.email?.message}>
        {(control) => <Input {...control} type="email" autoComplete="email" {...register("email")} />}
      </FormField>
      <FormField id="profile-mobile" label="Mobile number" optional error={errors.mobile?.message}>
        {(control) => (
          <div className="flex">
            <span className="flex items-center rounded-l-xl border border-r-0 border-input bg-soft px-3 text-base font-medium text-muted-foreground">
              +91
            </span>
            <Input
              {...control}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={16}
              className="rounded-l-none"
              {...register("mobile", { setValueAs: normalizeMobile })}
            />
          </div>
        )}
      </FormField>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Save changes
      </Button>
    </form>
  );
}

interface EditProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: CustomerProfile;
}

export function EditProfileSheet({ open, onOpenChange, profile }: EditProfileSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="text-lg font-bold">Edit profile</SheetTitle>
          <SheetDescription>Demo profile stored on this device only.</SheetDescription>
        </SheetHeader>
        <ProfileForm profile={profile} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
