"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/common/form-field";
import { ORDER_NUMBER_REGEX } from "@/lib/checkout/contract";
import { getGuestToken, saveGuestOrderRef } from "@/lib/checkout/local-state";
import { trackGuestOrder } from "@/lib/services/checkout";
import { toErrorMessage } from "@/lib/services/errors";
import type { Order } from "@/lib/types";
import { OrderView } from "./order-detail";

/**
 * Guest order lookup. The tracking code is read from the URL fragment (#t=...), which browsers never send to
 * a server, then POSTed so it does not end up in access logs. Wrong code and unknown order look the same.
 */
export function TrackOrder({ initialOrderNumber }: { initialOrderNumber: string }) {
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [code, setCode] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(number: string, token: string) {
    setBusy(true);
    setError(null);
    try {
      const found = await trackGuestOrder(number.trim().toUpperCase(), token.trim());
      if (!found) {
        setOrder(null);
        setError("We couldn't find an order with that number and tracking code.");
        return;
      }
      saveGuestOrderRef(found.orderNumber, token.trim()); // remember it on this device
      setOrder(found);
    } catch (caught) {
      setOrder(null);
      setError(toErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = fragment.get("t") ?? (initialOrderNumber ? getGuestToken(initialOrderNumber) : undefined);
    if (initialOrderNumber && token) {
      setCode(token); // eslint-disable-line react-hooks/set-state-in-effect
      void lookup(initialOrderNumber, token);
      // Strip the secret from the address bar once it has been used.
      if (fragment.has("t")) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [initialOrderNumber]);

  if (order) {
    return (
      <div className="space-y-4">
        <OrderView order={order} onRefresh={() => lookup(order.orderNumber, code)} />
      </div>
    );
  }

  const valid = ORDER_NUMBER_REGEX.test(orderNumber.trim().toUpperCase()) && code.trim().length >= 20;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) void lookup(orderNumber, code);
      }}
      className="space-y-4 rounded-2xl border bg-white p-4"
    >
      <FormField id="track-number" label="Order number" hint="Looks like SW-261027-1001">
        {(control) => (
          <Input {...control} value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} autoComplete="off" autoCapitalize="characters" />
        )}
      </FormField>
      <FormField id="track-code" label="Tracking code" hint="The long code in your private tracking link, after #t=">
        {(control) => (
          <Input {...control} value={code} onChange={(event) => setCode(event.target.value)} autoComplete="off" spellCheck={false} />
        )}
      </FormField>
      {error ? (
        <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={!valid || busy} aria-busy={busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
        Track order
      </Button>
    </form>
  );
}
