"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INDIAN_STATES } from "@/lib/validation/indian-states";
import { normalizeMobile, type AddressFormValues } from "@/lib/validation/schemas";
import { FormField, NativeSelect } from "./form-field";

interface AddressFormFieldsProps {
  register: UseFormRegister<AddressFormValues>;
  errors: FieldErrors<AddressFormValues>;
  /** Prefix for element ids so two forms never collide on one page. */
  idPrefix?: string;
}

const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** The delivery-address inputs, shared by checkout and the profile address editor. */
export function AddressFormFields({ register, errors, idPrefix = "addr" }: AddressFormFieldsProps) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <>
      <FormField id={id("fullName")} label="Full name" error={errors.fullName?.message}>
        {(control) => (
          <Input {...control} autoComplete="name" placeholder="e.g. Asha Rao" {...register("fullName")} />
        )}
      </FormField>

      <FormField
        id={id("mobile")}
        label="Mobile number"
        error={errors.mobile?.message}
        hint="We'll use this to reach you about delivery."
      >
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
              placeholder="10-digit mobile number"
              className="rounded-l-none"
              {...register("mobile", { setValueAs: normalizeMobile })}
            />
          </div>
        )}
      </FormField>

      <FormField id={id("line1")} label="House / flat no. and street" error={errors.line1?.message}>
        {(control) => <Input {...control} autoComplete="address-line1" {...register("line1")} />}
      </FormField>

      <FormField id={id("area")} label="Area / locality" error={errors.area?.message}>
        {(control) => <Input {...control} autoComplete="address-line2" {...register("area")} />}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={id("city")} label="City" error={errors.city?.message}>
          {(control) => <Input {...control} autoComplete="address-level2" {...register("city")} />}
        </FormField>
        <FormField id={id("pincode")} label="PIN code" error={errors.pincode?.message}>
          {(control) => (
            <Input
              {...control}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              placeholder="6 digits"
              {...register("pincode", { setValueAs: digitsOnly })}
            />
          )}
        </FormField>
      </div>

      <FormField id={id("state")} label="State" error={errors.state?.message}>
        {(control) => (
          <NativeSelect {...control} autoComplete="address-level1" {...register("state")}>
            <option value="">Select state</option>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <FormField
        id={id("instructions")}
        label="Delivery instructions"
        optional
        error={errors.instructions?.message}
      >
        {(control) => (
          <Textarea
            {...control}
            placeholder="Landmark, preferred time, gate code..."
            maxLength={200}
            {...register("instructions")}
          />
        )}
      </FormField>
    </>
  );
}
