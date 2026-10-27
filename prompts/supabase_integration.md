# SUPERWALLS — CRITICAL BACKEND REQUIREMENTS AMENDMENT

Update the Supabase integration requirements with the following final business decisions.

These instructions OVERRIDE any conflicting checkout, authentication, order creation, and payment requirements in the previous prompt.

Do not rebuild the frontend. Preserve the existing SuperWalls design and integrate these requirements into the current project.


Attched all credentials in .env.example for supabase, use that and move it to env local if necessary

## 1. CUSTOMER CHECKOUT: GUEST + REGISTERED CUSTOMER

SuperWalls must support BOTH checkout methods.

### A. Guest checkout



Customers must be able to:

- Browse products without registering.
- Add products to their cart.
- Proceed to checkout without creating an account.
- Enter their name, mobile number, email address, and complete delivery address.
- Review their order.
- Complete online payment.
- Receive an order confirmation.
- Access their order status through a secure guest order-tracking mechanism.

Guest customers must not be forced to create a Supabase account.

### B. Registered customer checkout

Customers with an account must be able to:

- Sign up and log in.
- Browse and purchase products.
- Have their profile information prefilled during checkout.
- Select a saved delivery address.
- Add or edit delivery addresses.
- View their complete order history.
- View individual order details and tracking information.

### C. Account creation after guest checkout

After a successful guest order, offer an optional account creation action.

If the guest creates an account, provide a secure mechanism to associate eligible previous guest orders with their newly authenticated account.

Never associate orders using email address alone without verifying ownership.

---

## 2. PAYMENT: ONLINE ONLY

SuperWalls will initially accept ONLINE PAYMENTS ONLY.

Do not implement Cash on Delivery.

The payment architecture must support a payment gateway such as Razorpay, subject to confirmation of the actual provider.

For now, create a modular payment service interface that can accommodate the selected gateway.

Do not pretend that a payment has succeeded when it has not.

### Payment flow

Implement this sequence:

1. Customer completes delivery information.
2. Customer reviews products, delivery address, and final amount.
3. Customer selects the online payment action.
4. Backend validates the customer, products, stock, prices, delivery charges, and order total.
5. Backend creates a pending-payment order.
6. Backend creates a payment session/order with the selected gateway through a trusted server-side integration.
7. Customer completes payment through the gateway.
8. Gateway sends a verified webhook or trusted server-side payment confirmation.
9. Backend verifies the payment signature and transaction details.
10. Backend updates the payment status.
11. Backend marks the order as confirmed/placed only after successful payment verification.
12. Frontend displays the successful order confirmation.

### Payment statuses

Use a clear payment status model:

- pending
- initiated
- paid
- failed
- cancelled
- refunded
- partially_refunded

Never mark an order as paid based solely on a frontend callback or redirect URL.

### Order statuses

Use:

- pending_payment
- placed
- confirmed
- processing
- shipped
- out_for_delivery
- delivered
- cancelled

Maintain a clear separation between payment status and fulfillment status.

### Failed payment behavior

If payment fails:

- Do not display a successful order confirmation.
- Preserve the pending order or safely expire it according to the payment lifecycle.
- Provide a Retry Payment action.
- Avoid creating duplicate orders on retry.
- Keep the cart available until the order/payment outcome is handled correctly.
- Ensure payment retries are idempotent.

### Inventory handling

Design a safe inventory reservation strategy.

- Reserve stock atomically when initiating payment.
- Prevent overselling.
- Use a configurable reservation expiry.
- Release reservations when payment fails, is cancelled, or expires.
- Confirm inventory deduction after verified successful payment.
- Handle delayed webhooks and duplicate webhooks safely.

Use database transactions and appropriate locking for inventory-sensitive operations.

---

## 3. GUEST ORDER SECURITY — CRITICAL

Guest checkout must not require a Supabase Auth user ID.

Design a secure guest-order model.

Requirements:

- Store guest customer information in the order record or an appropriately designed customer snapshot.
- Generate a cryptographically secure, high-entropy guest order access token.
- Store only a secure hash of the tracking token in the database where feasible.
- Never use sequential order IDs or publicly guessable identifiers as authentication.
- Provide a secure server-side guest order lookup mechanism.
- Validate the guest tracking token before returning order details.
- Never expose another customer's address, phone number, email, or payment details.
- Rate-limit guest tracking requests.
- Do not allow guest customers to modify order fulfillment or payment statuses.

Use separate authenticated and guest authorization paths.

Authenticated users should access their own orders through RLS.

Guest order access should use a narrowly scoped, trusted server-side verification mechanism. Do not make guest order data publicly readable through unrestricted RLS policies.

---

## 4. DATABASE SCHEMA CHANGES

Adapt the previous schema.

### Orders table

Support both registered and guest customers.

Recommended additional fields:

- customer_type: registered or guest
- user_id: nullable UUID referencing auth.users
- customer_email
- customer_phone
- customer_name
- address_snapshot
- payment_status
- order_status
- payment_provider
- payment_reference
- idempotency_key
- guest_tracking_token_hash

Ensure the ownership constraints correctly distinguish registered and guest orders.

### Payments table

Create a dedicated payments table.

Suggested columns:

- id UUID PRIMARY KEY
- order_id UUID REFERENCES orders(id)
- provider TEXT
- provider_order_id TEXT
- provider_payment_id TEXT
- amount BIGINT
- currency TEXT DEFAULT 'INR'
- status TEXT
- idempotency_key TEXT
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

Add appropriate unique constraints to prevent duplicate provider transactions and duplicate webhook processing.

### Inventory reservations

Create a suitable inventory reservation model if required.

Store:

- product_id
- order_id
- quantity
- reservation_status
- expires_at
- created_at

Ensure reservation creation, expiry, release, and confirmation are transaction-safe.

Adapt these schemas to the existing application rather than creating redundant tables.

---

## 5. SECURE BACKEND OPERATIONS

Implement trusted server-side operations for:

- Guest order creation.
- Registered order creation.
- Price and stock verification.
- Inventory reservation.
- Payment session creation.
- Payment verification.
- Payment webhook handling.
- Guest order tracking.
- Guest order-to-account association.

Use Next.js Route Handlers or securely implemented database RPC functions as appropriate.

If a service-role key is necessary for a privileged operation, it must remain exclusively server-side.

Never expose privileged credentials in the browser.

Validate all incoming requests.

Verify webhook signatures using the payment provider's official verification method.

Make webhook processing idempotent.

Do not trust the amount, payment status, product price, or order ownership submitted by the frontend.

---

## 6. FRONTEND CHANGES

Preserve the existing three-step checkout design.

Update it to support both guest and registered customers.

For guest customers:

Step 1: Customer and delivery details.

Step 2: Order review and online payment.

Step 3: Confirmation after verified successful payment.

For registered customers:

Step 1: Prefilled customer and delivery information, with saved-address selection.

Step 2: Order review and online payment.

Step 3: Confirmation after verified successful payment.

Add:

- Clear payment loading state.
- Payment failure state.
- Retry payment action.
- Pending payment state.
- Successful payment confirmation.
- Guest order tracking access.
- Registered customer order history.

Do not display fake success messages.

Do not clear the cart before the order/payment lifecycle has been handled successfully.

---

## 7. PAYMENT GATEWAY CONFIGURATION

The payment gateway has not yet been finalized.

Do not assume that Razorpay credentials are available.

Create a modular interface such as:

- createPaymentSession()
- verifyPayment()
- handlePaymentWebhook()
- refundPayment()

Implement the provider adapter only after the actual provider and its credentials are supplied.

If the provider is not configured, make the payment flow clearly report that payment configuration is incomplete. Do not simulate a successful production payment.

Document the gateway configuration variables and webhook setup required.

Keep all secret credentials server-side.

---

## 8. FINAL ACCEPTANCE TESTS

Verify all of these scenarios:

1. Guest can browse and add products to cart.
2. Guest can complete delivery details without registering.
3. Guest can initiate online payment.
4. Guest cannot access another guest's order.
5. Registered user can log in and purchase.
6. Registered user's details and saved addresses are prefilled.
7. Registered user can see their own order history.
8. A failed payment does not mark an order as paid.
9. A successful verified payment marks the order as paid.
10. Duplicate payment webhooks do not duplicate orders or inventory deductions.
11. Payment retries do not create duplicate orders.
12. Inventory cannot be oversold.
13. Expired payment reservations are released safely.
14. Guest orders can be associated with a newly created account only after ownership verification.
15. Customer cannot manually update order or payment status.
16. RLS prevents unauthorized access to customer records.
17. No service-role key is exposed in frontend code.

Update the README with the guest checkout architecture, authentication behavior, payment lifecycle, security rules, and required payment gateway setup.

IMPORTANT:

The two business decisions are FINAL:

- Checkout: Both guest checkout and registered customer checkout.
- Payment: Online payment only. No Cash on Delivery.

Implement these requirements throughout the application and backend architecture.