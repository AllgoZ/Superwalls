import { z } from "zod";

/** Indian mobile number: 10 digits starting with 6-9. */
export const MOBILE_REGEX = /^[6-9]\d{9}$/;
/** Indian PIN code: 6 digits, first digit non-zero. */
export const PINCODE_REGEX = /^[1-9]\d{5}$/;

/** Reduces pasted input like "+91 98765 43210" or "098765 43210" to 10 digits. */
export function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export const addressSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(80, "Name is too long"),
  mobile: z
    .string()
    .trim()
    .regex(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
  line1: z
    .string()
    .trim()
    .min(5, "Enter your house / flat number and street")
    .max(200, "Address is too long"),
  area: z.string().trim().min(2, "Enter your area or locality").max(100, "Too long"),
  city: z.string().trim().min(2, "Enter your city").max(60, "Too long"),
  state: z.string().trim().min(1, "Select your state"),
  pincode: z.string().trim().regex(PINCODE_REGEX, "Enter a valid 6-digit PIN code"),
  instructions: z.string().trim().max(200, "Keep instructions under 200 characters"),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

/** Delivery step: the address plus the contact email used for the order confirmation. */
export const deliverySchema = addressSchema.extend({
  email: z.email("Enter a valid email address").max(254, "Email is too long"),
});
export type DeliveryFormValues = z.infer<typeof deliverySchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(80, "Name is too long"),
  mobile: z.union([z.literal(""), z.string().regex(MOBILE_REGEX, "Enter a valid 10-digit mobile number")]),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const PASSWORD_MIN_LENGTH = 8;

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(80, "Name is too long"),
  email: z.email("Enter a valid email address").max(254, "Email is too long"),
  mobile: z.union([z.literal(""), z.string().regex(MOBILE_REGEX, "Enter a valid 10-digit mobile number")]),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`).max(72, "Password is too long"),
});
export type SignUpFormValues = z.infer<typeof signUpSchema>;
