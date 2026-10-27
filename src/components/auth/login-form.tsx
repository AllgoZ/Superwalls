"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/common/form-field";
import { safeNextPath } from "@/lib/navigation";
import { signIn } from "@/lib/services/auth";
import { toErrorMessage } from "@/lib/services/errors";
import { loginSchema, type LoginFormValues } from "@/lib/validation/schemas";

export function LoginForm({ next, justVerified }: { next?: string; justVerified: boolean }) {
  const router = useRouter();
  const destination = safeNextPath(next, "/profile");
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), mode: "onTouched" });

  async function onSubmit(values: LoginFormValues) {
    try {
      await signIn(values.email, values.password);
      toast.success("Signed in");
      router.push(destination);
    } catch (error) {
      setError("root", { message: toErrorMessage(error) });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 rounded-2xl border bg-white p-4">
      {justVerified ? (
        <p role="status" className="rounded-xl bg-success-soft px-3 py-2.5 text-sm font-medium text-success">
          Email verified. Log in to continue.
        </p>
      ) : null}

      <FormField id="login-email" label="Email" error={errors.email?.message}>
        {(control) => <Input {...control} type="email" autoComplete="email" inputMode="email" {...register("email")} />}
      </FormField>
      <FormField id="login-password" label="Password" error={errors.password?.message}>
        {(control) => <Input {...control} type="password" autoComplete="current-password" {...register("password")} />}
      </FormField>

      {errors.root?.message ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
          {errors.root.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
        Log in
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href={`/signup?next=${encodeURIComponent(destination)}`} className="font-semibold text-brand-blue underline">
          Create an account
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Or{" "}
        <Link href="/#products" className="font-semibold text-brand-blue underline">
          keep shopping as a guest
        </Link>
        . No account needed.
      </p>
    </form>
  );
}
