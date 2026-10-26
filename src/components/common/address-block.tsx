import type { AddressFields } from "@/lib/types";

export function AddressBlock({ address }: { address: AddressFields }) {
  return (
    <address className="text-sm leading-relaxed not-italic text-ink">
      <p className="font-semibold">{address.fullName}</p>
      <p>{address.line1}</p>
      <p>
        {address.area}, {address.city}
      </p>
      <p>
        {address.state} – {address.pincode}
      </p>
      <p className="mt-1 text-muted-foreground">Mobile: +91 {address.mobile}</p>
      {address.instructions ? (
        <p className="mt-1 text-muted-foreground">Note: {address.instructions}</p>
      ) : null}
    </address>
  );
}
