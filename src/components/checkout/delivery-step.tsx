"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, LogIn } from "lucide-react";
import { useForm, useWatch, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressFormFields } from "@/components/common/address-form-fields";
import { FormField } from "@/components/common/form-field";
import type { Address } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deliverySchema, type AddressFormValues, type DeliveryFormValues } from "@/lib/validation/schemas";

export const EMPTY_ADDRESS: AddressFormValues = {
  fullName: "",
  mobile: "",
  line1: "",
  area: "",
  city: "",
  state: "",
  pincode: "",
  instructions: "",
};

export const EMPTY_DELIVERY: DeliveryFormValues = { ...EMPTY_ADDRESS, email: "" };

interface DeliveryStepProps {
  initialValues: DeliveryFormValues;
  /** Registered customers: email comes from their verified account and cannot be changed here. */
  signedIn: boolean;
  savedAddresses: Address[];
  /** Path to return to after logging in from checkout. */
  loginNext: string;
  onSubmit: (values: DeliveryFormValues) => void;
}

function addressToValues(address: Address, email: string): DeliveryFormValues {
  return {
    fullName: address.fullName,
    mobile: address.mobile,
    line1: address.line1,
    area: address.area,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    instructions: address.instructions ?? "",
    email,
  };
}

export function DeliveryStep({ initialValues, signedIn, savedAddresses, loginNext, onSubmit }: DeliveryStepProps) {
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliverySchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });

  const current = useWatch({ control }) as Partial<DeliveryFormValues>;
  const selectedId = savedAddresses.find(
    (address) => address.line1 === current.line1 && address.pincode === current.pincode && address.mobile === current.mobile,
  )?.id;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4" aria-labelledby="delivery-heading">
      <h2 id="delivery-heading" className="text-lg font-bold text-ink">
        Where should we deliver?
      </h2>

      {signedIn ? null : (
        <p className="flex items-start gap-2.5 rounded-2xl bg-brand-blue-soft px-4 py-3 text-sm text-ink">
          <LogIn className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden />
          <span>
            Checking out as a guest. No account needed.{" "}
            <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className="font-semibold text-brand-blue underline">
              Log in
            </Link>{" "}
            to use your saved details.
          </span>
        </p>
      )}

      {signedIn && savedAddresses.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold text-ink">Saved addresses</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {savedAddresses.map((address) => {
              const selected = address.id === selectedId;
              return (
                <button
                  key={address.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => reset(addressToValues(address, current.email ?? ""))}
                  className={cn(
                    "flex min-h-14 items-start gap-2.5 rounded-xl border p-3 text-left transition-colors hover:bg-soft",
                    selected && "border-brand-blue bg-brand-blue-soft/50",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-brand-blue bg-brand-blue text-white" : "border-border",
                    )}
                  >
                    {selected ? <Check className="size-3" /> : null}
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className="block font-semibold text-ink">
                      {address.fullName}
                      {address.isDefault ? <span className="font-normal text-muted-foreground"> · Default</span> : null}
                    </span>
                    <span className="block truncate text-muted-foreground">
                      {address.line1}, {address.area}, {address.city} – {address.pincode}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <FormField
        id="delivery-email"
        label="Email"
        error={errors.email?.message}
        hint={signedIn ? "From your account." : "We'll send your order confirmation here."}
      >
        {(control) => (
          <Input
            {...control}
            type="email"
            autoComplete="email"
            inputMode="email"
            readOnly={signedIn}
            placeholder="you@example.com"
            {...register("email")}
          />
        )}
      </FormField>

      <AddressFormFields
        register={register as unknown as UseFormRegister<AddressFormValues>}
        errors={errors as unknown as FieldErrors<AddressFormValues>}
        idPrefix="delivery"
      />

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-white px-4 pt-3 pb-3 md:static md:border-0 md:bg-transparent md:p-0">
        <Button type="submit" size="lg" className="w-full md:w-auto md:min-w-56">
          Continue to Review
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </form>
  );
}
