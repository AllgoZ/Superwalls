# Project: SuperWalls — Mobile-First E-commerce Frontend

Act as a senior frontend engineer and UI/UX designer. Build a polished, production-quality frontend for **SuperWalls**, a cleaning products and home-care brand.

The attached image is the official SuperWalls logo. Use it as the primary reference for the visual identity.
"reference\logo.jpeg"
## 1. Objective

Build a modern, mobile-first e-commerce web application that feels like a native shopping app.

The business has only a small number of products, so do not build a complicated marketplace. Prioritize:

- Fast, simple product browsing.
- An easy add-to-cart experience.
- A genuinely usable three-step checkout.
- A dedicated Orders page accessible from bottom navigation.
- A Profile page containing account details and useful settings.
- An architecture that can integrate with Supabase without rewriting the frontend.
- A future WhatsApp integration for order tracking and customer support.

Build the actual working frontend in the project files, not just a mockup, wireframe, or explanation.

## 2. Required technology stack

Use the following stack:

- Next.js with the App Router.
- TypeScript with strict typing.
- Tailwind CSS.
- shadcn/ui for accessible UI components where appropriate.
- Lucide React for icons.
- React Hook Form and Zod for form validation where useful.
- Zustand or a lightweight React Context for cart state. Choose one, not both.
- A service/repository layer that can later connect to Supabase using `@supabase/supabase-js`.
- Local mock data for the initial frontend, because the Supabase backend is not yet connected.

Use stable, mutually compatible package versions and follow the conventions of the installed Next.js version.

Do not introduce an unnecessary state management library, heavy animation framework, or large UI framework.

## 3. Brand identity and design system

Use the attached SuperWalls logo.

Brand name: SuperWalls

Tagline: Cleaner Homes, Happy Life

Suggested brand palette:

- Primary blue: #1556B5
- Accent yellow: #FFC400
- White: #FFFFFF
- Soft background: #F5F7FA
- Primary text: #172033
- Secondary text: #667085
- Border: #E5E7EB
- Success: a readable green tone.
- Error: a readable red tone.

Adjust the primary blue and yellow to match the attached logo more accurately.

Design requirements:

- Minimal, modern, clean, and trustworthy.
- Mobile-first, responsive, and touch-friendly.
- White backgrounds and generous whitespace.
- Blue primary buttons with clear contrast.
- Yellow used sparingly for highlights, promotional accents, and selected brand details.
- Rounded product cards, consistent spacing, subtle borders, and restrained shadows.
- Smooth but subtle transitions.
- Clear typography with an appropriate modern sans-serif font.
- Accessible focus indicators and keyboard navigation.
- Proper loading, empty, success, and error states.
- Consistent icon sizes and button styles.
- Avoid unnecessary gradients, excessive animations, excessive rounded containers, clutter, and oversized headings.
- Avoid generic dashboard aesthetics.

Use a bottom navigation bar on mobile that stays accessible while navigating the application. Account for mobile safe areas and do not let it cover page content.

## 4. Main application navigation

Create a persistent mobile bottom navigation with exactly these three primary destinations:

1. Home
2. Orders
3. Profile

Use intuitive Lucide icons and text labels beneath or alongside the icons, with a clear selected state.

Navigation behavior:

- Home opens the storefront.
- Orders opens the order history and tracking page.
- Profile opens the account and settings page.

The selected tab must update correctly when navigating between routes.

Keep the bottom navigation visible on the main application pages, including Home, Orders, and Profile.

On product details and checkout pages, preserve a coherent mobile experience and prevent the bottom navigation from obstructing important actions. You may hide it during checkout if doing so materially improves the focused checkout experience.

Use a desktop-responsive layout with a sensible top navigation or equivalent desktop navigation. Do not simply stretch the mobile layout across a desktop screen.

## 5. Home page

Create a polished storefront at `/`.

The home page should contain:

### Header
- SuperWalls logo.
- A compact, friendly greeting or brand introduction.
- A cart icon with a live item-count badge.
- A clear route to the cart.

### Hero section
- A concise heading, such as "A cleaner home starts here."
- One short supporting sentence.
- A restrained brand-colored visual treatment.
- A prominent "Shop Products" action that scrolls to or navigates to the product listing.

Keep the hero compact on mobile so products appear without excessive scrolling.

### Product listing
- A simple "Our Products" section.
- A small number of sample products, approximately 4–6.
- Responsive product cards.
- Product image, name, price in INR, optional original price, and a short description where appropriate.
- A clear "Add to Cart" action.
- A way to open product details.
- Quantity controls or an appropriate add-to-cart state when a product is already in the cart.

Do not invent real SuperWalls products or imply that sample prices are actual business prices. Use clearly identifiable demo products and placeholder pricing until real catalog data is provided.

Do not create many unnecessary categories, filters, or sorting controls when only a few products exist.

### Additional sections
- A compact trust section, using factual placeholder content only.
- A small promotional or brand-benefit section if it improves the design.
- A minimal footer with relevant links.

Keep the entire home page lightweight and conversion-focused.

## 6. Product details

Create a reusable product details experience, either through a dynamic route such as `/products/[id]` or an equivalent well-structured implementation.

Include:

- Product image gallery or primary image.
- Product name.
- Price and optional original price.
- Description.
- Available product variants only if the sample data supports them.
- Quantity selector.
- Add-to-cart button.
- Stock availability state.
- Clear navigation back to shopping.

Use proper TypeScript types and handle invalid product IDs gracefully.

## 7. Shopping cart

Create a dedicated cart route at `/cart`.

Required behavior:

- List all cart items.
- Display product images, names, unit prices, and quantities.
- Increase or decrease quantities.
- Remove an item.
- Calculate line totals and subtotal accurately.
- Show delivery charges and discounts as configurable values rather than hardcoded business policies.
- Calculate the final payable amount correctly.
- Show a useful empty-cart state with a "Continue Shopping" action.
- Provide a prominent "Proceed to Checkout" button.

Persist the cart across page navigation and refreshes. For the initial frontend, local storage may be used for cart persistence.

Keep all money calculations in integer paise internally where appropriate, and format displayed amounts using the Indian locale and INR currency formatting.

Prevent negative quantities and invalid totals.

## 8. Three-step checkout — critical requirement

Build a real, interactive three-step checkout flow at `/checkout`.

Make it simple enough for a first-time mobile user to complete without confusion.

### Step 1: Delivery details

Collect:
- Customer's full name.
- Mobile number.
- Delivery address.
- Area/locality.
- City.
- State.
- PIN code.
- Optional delivery instructions.

Requirements:
- Mobile-friendly inputs.
- Proper required-field validation.
- Validate Indian mobile numbers and PIN codes sensibly.
- Clear inline validation messages.
- Allow the user to review or edit information before continuing.
- If authenticated user data is available later, prefill known details.

### Step 2: Order review and payment method

Display:
- Selected products and quantities.
- Delivery address.
- Item subtotal.
- Delivery charge.
- Discount, if applicable.
- Final payable total.

Allow the customer to return to Step 1 and edit the delivery address.

Provide a payment-method selection component that can support configurable methods such as Cash on Delivery and online payment.

Important:
- Do not pretend an online payment has succeeded.
- Do not implement a fake payment gateway.
- Do not collect or store card details.
- Keep payment execution behind a dedicated payment service interface for future integration.
- Make the payment methods configurable because the actual business policy has not yet been specified.

### Step 3: Confirmation

Display:
- A clear order success state after a successful mock order submission.
- A generated demo order number.
- Order summary.
- Delivery address.
- Payment method and payment status.
- "View My Orders" button.
- "Continue Shopping" button.

For the initial frontend, simulate order creation through a mock service and show a clearly identifiable demo order.

Never create the order simply because the customer opens the confirmation page. Create it only after the required steps are valid and the submission succeeds.

Protect against duplicate submissions with a loading state and appropriate safeguards.

Keep the checkout state coherent when the user moves backward and forward between steps.

Use a compact three-step progress indicator, such as:
Delivery → Review & Pay → Confirmation.

Do not turn the checkout into a long single-page form.

## 9. Orders page

Create `/orders`.

This page is a core feature and must be accessible from the bottom navigation.

### Orders list
- Show previous orders.
- Display order number, order date, total amount, payment status, and fulfillment status.
- Show a concise summary of the products in each order.
- Provide a "View Details" action.
- Include an empty state with a "Start Shopping" button when there are no orders.
- Support loading and error states for the future backend.

### Order details
Create an order details page or expandable details view.

Display:
- Order ID and creation date.
- Items, quantities, and prices.
- Subtotal, delivery fee, discount, and total.
- Delivery address.
- Payment method and payment status.
- Order status and a simple status timeline.

Use realistic status values, for example:
`placed`, `confirmed`, `processing`, `shipped`, `out_for_delivery`, `delivered`, and `cancelled`.

Keep status labels and transitions centralized so they can be adapted to the actual backend workflow.

Do not allow customers to change an order's fulfillment status from the frontend.

For demo mode, populate the Orders page with mock orders or orders created through the mock checkout service. Clearly distinguish demo data from real orders.

## 10. Profile page

Create `/profile`, accessible through the bottom navigation.

Use a clean account screen with grouped settings.

Include:

### Account
- Customer name.
- Email and mobile number where available.
- Sign-in or sign-out action depending on authentication state.
- Edit profile action.

### Delivery
- Saved delivery address section.
- Add or edit address interface.

### Shopping and support
- My Orders shortcut.
- Help and Support.
- Contact Us.
- WhatsApp support placeholder.
- Frequently Asked Questions, if useful.

### Preferences and information
- Notification preferences placeholder.
- Privacy Policy.
- Terms and Conditions.
- App or website version.

Keep secondary options organized into simple lists. Do not create unnecessary nested settings pages.

Implement the UI states for unauthenticated and authenticated users, with mock authentication behavior clearly separated from production authentication.

Do not imply that mock sign-in provides real account security.

## 11. Supabase compatibility — design for future integration

The first deliverable is the frontend, but its architecture must make connecting Supabase straightforward.

Install and configure the Supabase client package only as appropriate for the project.

Prepare a clean separation between UI components, business logic, and data access.

Suggested structure:

- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts` if needed for server-side operations.
- `src/lib/services/products.ts`
- `src/lib/services/orders.ts`
- `src/lib/services/profile.ts`
- `src/lib/services/addresses.ts`
- `src/lib/services/payments.ts`
- `src/lib/types/`
- `src/lib/formatters/`
- `src/components/`
- `src/app/`

Adapt the structure to the existing project if necessary; do not create redundant files merely to match this list.

Define typed models for:

- Product.
- ProductVariant, only if needed.
- CartItem.
- CustomerProfile.
- Address.
- Order.
- OrderItem.
- PaymentMethod.
- PaymentStatus.
- OrderStatus.

Keep the types consistent across UI, mock services, and future Supabase integration.

Use service functions such as:
- `getProducts()`
- `getProductById(id)`
- `getOrders()`
- `getOrderById(id)`
- `createOrder(input)`
- `getProfile()`
- `updateProfile(input)`
- `getAddresses()`
- `saveAddress(input)`

The UI should call these service functions instead of directly accessing mock arrays throughout individual components.

Create a clean mock-data implementation that can later be replaced by Supabase-backed implementations without rewriting the UI.

Use environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Never expose a Supabase service-role key or other privileged secrets to the browser.

If the environment variables are missing, the frontend should still run in demo mode with a clear separation between demo and production behavior.

Do not pretend that Supabase is connected when it is not.

### Future database compatibility

Design the models and service contracts to accommodate Supabase tables such as:
- `products`
- `profiles`
- `addresses`
- `orders`
- `order_items`

Use a consistent naming convention and document the expected schema.

The future order creation flow should be designed to support a secure server-side or database-transactional operation that validates prices, stock, discounts, delivery charges, and totals. Never rely on client-submitted prices as the authoritative order amount.

For a production integration, enforce Row Level Security (RLS) and ensure users can access only their authorized profile, addresses, and orders.

Do not build a complete database migration or claim that RLS is configured as part of this frontend-only task. Document what will be required during backend integration.

## 12. Future WhatsApp integration

Prepare an integration point for future WhatsApp order tracking and customer support.

For example, create a support utility or service interface that can later:
- Open WhatsApp support with a configured business number.
- Include a safe, prefilled customer support message.
- Reference an order number where appropriate.
- Direct customers to order details or support.

Keep the WhatsApp business number in configuration rather than scattering it throughout the UI.

Use a placeholder until the actual number is provided.

Do not fabricate live WhatsApp tracking, message delivery, automated notifications, or WhatsApp Business API integration.

Explain in the README what would require a future WhatsApp Business API/webhook integration and what can work through a normal WhatsApp link.

## 13. UX and technical quality

Requirements:
- All primary buttons and links must perform their intended actions.
- No dead buttons or fake navigation.
- Accessible labels for all form fields.
- Proper loading, empty, success, and error states.
- Clear inline validation.
- Prevent double submission during checkout.
- Responsive layouts for mobile, tablet, and desktop.
- Semantic HTML and accessible interactions.
- Consistent spacing, typography, colors, and reusable components.
- Correct image aspect ratios and graceful fallbacks when product images are unavailable.
- Use optimized images where appropriate.
- Avoid layout shifts and unnecessary re-renders.
- Avoid duplicating business logic across components.
- Keep components small, reusable, and typed.
- Use client components only where interactivity requires them.
- Do not use `any` unless there is a compelling, documented reason.
- Do not suppress TypeScript errors just to make the build pass.
- Do not add unnecessary dependencies.

Use accessible toast notifications or inline feedback for cart updates, form submissions, and recoverable errors.

## 14. Demo data and configuration

Since the actual catalog, delivery policies, and payment policies are not yet available:

- Use a small set of clearly labeled demo products.
- Use configurable demo prices.
- Keep product image URLs or local asset paths in the mock catalog data.
- Keep delivery fees and discounts configurable.
- Keep payment methods configurable.
- Use sample orders to demonstrate the Orders page.
- Clearly identify demo behavior in the README and relevant development UI.

Do not invent actual company contact details, delivery guarantees, product claims, or customer reviews.

Use the provided logo asset wherever the brand is displayed. If the asset is available in the project, reference it directly instead of redrawing it or replacing it with generic text.

## 15. Deliverables

Implement the complete frontend in the current project.

Deliver:
1. A functional home page.
2. Product cards and product details.
3. Working cart with quantity management and persistence.
4. A validated, three-step checkout.
5. Order confirmation.
6. Orders list and order details.
7. Profile and settings.
8. Persistent mobile bottom navigation for Home, Orders, and Profile.
9. Typed mock data and replaceable service interfaces.
10. Supabase client setup that does not require real credentials to run the demo frontend.
11. Responsive and accessible UI components.
12. A README containing installation instructions, environment variables, routes, demo-mode instructions, architecture, and future Supabase/WhatsApp integration notes.

## 16. Execution instructions

First inspect the existing project files and package configuration. If a working project already exists, preserve its setup and adapt it rather than overwriting it blindly.

Then implement the application, install only the dependencies that are needed, and run the available checks.

At minimum:
- Run the production build.
- Run linting and TypeScript checks where the project supports them.
- Fix errors introduced by your changes.
- Verify that the key routes render.
- Verify cart totals and quantity changes.
- Verify checkout validation and step navigation.
- Verify mock order creation and Orders page updates.
- Verify bottom navigation and mobile layout.
- Verify the application runs without Supabase credentials in demo mode.

If browser automation is available, exercise the main shopping flow from adding a product through order confirmation and then viewing the order.

Do not stop after creating a plan or generating the home page. Complete the core flow and fix any issues you discover.

If an external service or missing credential prevents a feature from being genuinely integrated, implement an honest demo fallback and document the limitation.

**Priority order:** excellent mobile UX → reliable cart → three-step checkout → Orders page → Profile → Supabase-ready architecture → future WhatsApp support.

The final result should look like a polished, modern, lightweight shopping app designed specifically for the SuperWalls brand, not a generic admin dashboard or a copied e-commerce template.