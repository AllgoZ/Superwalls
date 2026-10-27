import { z } from "zod";

const optionalInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();

export const promotionSchema = z
  .object({
    id: z.uuid().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,23}$/, "Use 3–24 letters, numbers, hyphens or underscores."),
    description: z.string().trim().max(300).default(""),
    discountType: z.enum(["percent", "fixed"]),
    percentOff: optionalInt(1, 100),
    fixedOffPaise: optionalInt(1, 100_000_000),
    minOrderPaise: z.number().int().min(0).max(1_000_000_000).default(0),
    /** Caps a percentage discount. Not used for fixed amounts. */
    maxDiscountPaise: optionalInt(1, 100_000_000),
    startsAt: z.iso.datetime({ offset: true }).nullable(),
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    maxUses: optionalInt(1, 10_000_000),
    maxUsesPerCustomer: optionalInt(1, 1_000),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.discountType === "percent") {
      if (value.percentOff === null) ctx.addIssue({ code: "custom", path: ["percentOff"], message: "Enter a percentage between 1 and 100." });
      if (value.fixedOffPaise !== null) ctx.addIssue({ code: "custom", path: ["fixedOffPaise"], message: "A percentage coupon has no fixed amount." });
    } else {
      if (value.fixedOffPaise === null) ctx.addIssue({ code: "custom", path: ["fixedOffPaise"], message: "Enter the amount off." });
      if (value.percentOff !== null) ctx.addIssue({ code: "custom", path: ["percentOff"], message: "A fixed coupon has no percentage." });
      if (value.maxDiscountPaise !== null) ctx.addIssue({ code: "custom", path: ["maxDiscountPaise"], message: "A maximum discount only applies to percentage coupons." });
    }
    if (value.startsAt && value.expiresAt && Date.parse(value.expiresAt) <= Date.parse(value.startsAt)) {
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "The expiry must be after the start." });
    }
    if (value.discountType === "fixed" && value.fixedOffPaise !== null && value.minOrderPaise > 0 && value.fixedOffPaise > value.minOrderPaise) {
      ctx.addIssue({ code: "custom", path: ["fixedOffPaise"], message: "The discount can't exceed the minimum order amount." });
    }
  });

export type PromotionInput = z.infer<typeof promotionSchema>;

export const inventoryAdjustSchema = z.object({
  productId: z.string().min(2).max(60),
  mode: z.enum(["delta", "set"]),
  /** For "delta" this may be negative; for "set" it is the new on-hand count. */
  quantity: z.number().int().min(-1_000_000).max(1_000_000),
  kind: z.enum(["adjustment", "correction", "restock", "damage", "return"]),
  reason: z.string().trim().min(3, "Say why the stock is changing.").max(300),
});
export type InventoryAdjustInput = z.infer<typeof inventoryAdjustSchema>;

export const MOVEMENT_KIND_LABEL: Record<string, string> = {
  adjustment: "Adjustment",
  correction: "Correction",
  restock: "Restock",
  damage: "Damaged / lost",
  return: "Customer return",
  sale: "Sale",
  order_cancelled: "Order cancelled",
};
