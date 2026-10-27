"use client";

import Link from "next/link";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/common/form-field";
import { safeNextPath } from "@/lib/navigation";
import { signUp } from "@/lib/services/auth";
import { toErrorMessage } from "@/lib/services/errors";
import { normalizeMobile, signUpSchema, type SignUpFormValues } from "@/lib/validation/schemas";

export function SignUpForm({ next }: { next?: string }) {
  const destination = safeNextPath(next, "/profile");
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValues>({ resolver: zodResolver(signUpSchema), defaultValues: { mobile: "" }, mode: "onTouched" });

  async function onSubmit(values: SignUpFormValues) {
    try {
      const result = await signUp({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        mobile: values.mobile || undefined,
      });
      // Even if no verification is required, there is nothing to hide: send them on.
      setVerifyEmail(result.needsEmailVerification ? values.email : "");
    } catch (error) {
      setError("root", { message: toErrorMessage(error) });
    }
  }

  if (verifyEmail !== null) {
    return (
      <div role="status" className="space-y-4 rounded-2xl border bg-white p-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
          <MailCheck className="size-7" aria-hidden />
        </div>
        <h2 className="text-lg font-extrabold text-ink">{verifyEmail ? "Check your email" : "Account created"}</h2>
        <p className="text-sm text-muted-foreground">
          {verifyEmail
            ? `We sent a verification link to ${verifyEmail}. Open it, then log in. Any orders you placed as a guest are added to your account after you verify.`
            : "You're all set. Log in to continue."}
        </p>
        <Link href={`/login?next=${encodeURIComponent(destination)}`} className={buttonVariants({ size: "lg" })}>
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 rounded-2xl border bg-white p-4">
      <FormField id="signup-name" label="Full name" error={errors.fullName?.message}>
        {(control) => <Input {...control} autoComplete="name" {...register("fullName")} />}
      </FormField>
      <FormField
        id="signup-email"
        label="Email"
        error={errors.email?.message}
        hint="Use the email you gave when ordering to find earlier orders."
      >
        {(control) => <Input {...control} type="email" autoComplete="email" inputMode="email" {...register("email")} />}
      </FormField>
      <FormField id="signup-mobile" label="Mobile number" optional error={errors.mobile?.message}>
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
      <FormField id="signup-password" label="Password" error={errors.password?.message} hint="At least 8 characters.">
        {(control) => <Input {...control} type="password" autoComplete="new-password" {...register("password")} />}
      </FormField>

      {errors.root?.message ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <UserPlus aria-hidden />}
        Create account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(destination)}`} className="font-semibold text-brand-blue underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
