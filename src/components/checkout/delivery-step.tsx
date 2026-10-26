"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { AddressFormFields } from "@/components/common/address-form-fields";
import { addressSchema, type AddressFormValues } from "@/lib/validation/schemas";

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

interface DeliveryStepProps {
  initialValues: AddressFormValues;
  onSubmit: (values: AddressFormValues) => void;
}

export function DeliveryStep({ initialValues, onSubmit }: DeliveryStepProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-4"
      aria-labelledby="delivery-heading"
    >
      <h2 id="delivery-heading" className="text-lg font-bold text-ink">
        Where should we deliver?
      </h2>

      <AddressFormFields register={register} errors={errors} idPrefix="delivery" />

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-white px-4 pt-3 pb-3 md:static md:border-0 md:bg-transparent md:p-0">
        <Button type="submit" size="lg" className="w-full md:w-auto md:min-w-56">
          Continue to Review
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </form>
  );
}
