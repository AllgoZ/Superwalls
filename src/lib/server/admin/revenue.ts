import "server-only";

/**
 * THE definition of revenue, used by the dashboard, reports, customers and exports so the numbers always agree.
 *
 * An order's money counts as realised revenue only when ALL of these hold:
 *   - payment_status is `paid` or `partially_refunded`  (verified by a payment event, never set by an admin click)
 *   - the order is not cancelled                         (a cancelled-but-paid order is owed back, not earned)
 *   - paid_at is set
 * and its value is `total_paise - refunded_paise`.
 *
 * Therefore these never count: pending, failed, cancelled-unpaid, fully refunded, and paid-then-cancelled orders.
 * Revenue is attributed to the day the payment was verified (`paid_at`, Asia/Kolkata), orders to the day created.
 * Each order is one row, so a duplicated payment event can never double count.
 *
 * `o` must be the alias of the orders table in the query using these fragments.
 */
export const REALISED = `(o.payment_status in ('paid', 'partially_refunded') and o.order_status <> 'cancelled' and o.paid_at is not null)`;
export const NET_PAISE = `(o.total_paise - o.refunded_paise)`;
export const IST_DATE_PAID = `((o.paid_at at time zone 'Asia/Kolkata')::date)`;
export const IST_DATE_CREATED = `((o.created_at at time zone 'Asia/Kolkata')::date)`;

/** Paid orders that were cancelled: the customer is owed money back. Reported separately, never as revenue. */
export const AWAITING_REFUND = `(o.payment_status = 'paid' and o.order_status = 'cancelled')`;
