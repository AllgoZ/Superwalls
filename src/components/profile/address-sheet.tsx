"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AddressFormFields } from "@/components/common/address-form-fields";
import { EMPTY_ADDRESS } from "@/components/checkout/delivery-step";
import { saveAddress } from "@/lib/services/addresses";
import { toErrorMessage } from "@/lib/services/errors";
import type { Address } from "@/lib/types";
import { addressSchema, type AddressFormValues } from "@/lib/validation/schemas";

function AddressForm({ address, onDone }: { address?: Address; onDone: () => void }) {
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: address
      ? {
          fullName: address.fullName,
          mobile: address.mobile,
          line1: address.line1,
          area: address.area,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          instructions: address.instructions ?? "",
        }
      : EMPTY_ADDRESS,
    mode: "onTouched",
  });

  async function onSubmit(values: AddressFormValues) {
    try {
      await saveAddress({ ...values, id: address?.id, isDefault });
      toast.success(address ? "Address updated" : "Address saved");
      onDone();
    } catch (error) {
      toast.error(toErrorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 px-4 pb-6">
      <AddressFormFields register={register} errors={errors} idPrefix="saved" />
      <div className="flex items-center gap-2.5">
        <Checkbox
          id="saved-default"
          checked={isDefault}
          onCheckedChange={(checked) => setIsDefault(checked === true)}
        />
        <Label htmlFor="saved-default" className="text-sm text-ink">
          Use as my default address
        </Label>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Save address
      </Button>
    </form>
  );
}

interface AddressSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit to add a new address. */
  address?: Address;
}

export function AddressSheet({ open, onOpenChange, address }: AddressSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="text-lg font-bold">{address ? "Edit address" : "Add address"}</SheetTitle>
          <SheetDescription>Saved to your account for faster checkout.</SheetDescription>
        </SheetHeader>
        <AddressForm address={address} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
