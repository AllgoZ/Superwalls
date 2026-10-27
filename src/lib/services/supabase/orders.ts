import { ServiceError } from "../errors";
import type { OrdersRepository } from "../contracts";
import { ORDER_ROW_COLUMNS, orderFromRow, type OrderRow } from "../mappers";
import { currentUserId, requireClient } from "./client";

/** Reads go straight to Postgres through Row Level Security: a customer can only ever see their own orders. */
export const supabaseOrders: OrdersRepository = {
  async list() {
    if (!(await currentUserId())) return [];
    const { data, error } = await requireClient()
      .from("orders")
      .select(ORDER_ROW_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new ServiceError("UNKNOWN", "We couldn't load your orders right now.");
    return (data as unknown as OrderRow[]).map(orderFromRow);
  },

  async getByNumber(orderNumber) {
    if (!(await currentUserId())) return null;
    const { data, error } = await requireClient()
      .from("orders")
      .select(ORDER_ROW_COLUMNS)
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (error) throw new ServiceError("UNKNOWN", "We couldn't load this order right now.");
    return data ? orderFromRow(data as unknown as OrderRow) : null;
  },
};
