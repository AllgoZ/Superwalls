# SUPERWALLS — PHASE 3: COMPLETE CUSTOM ADMIN CMS DEVELOPMENT

Act as a senior full-stack architect, SaaS dashboard developer, UI/UX designer, and Supabase security specialist.

We are developing a custom e-commerce management CMS for SuperWalls.

The SuperWalls customer storefront and Supabase backend have already been developed in previous phases.

Now build a comprehensive, production-quality ADMIN CMS that allows the business owner and authorized staff to manage the complete e-commerce operation from one centralized dashboard.

IMPORTANT:

This is an existing application.

Do not rebuild the storefront.
Do not destroy existing Supabase tables.
Do not replace working authentication.
Do not break guest checkout or registered customer checkout.
Do not change the existing customer-facing design unnecessarily.

Build the admin panel as a separate, protected application area within the existing Next.js project.

The CMS must use the same Supabase project and database as the customer storefront.

The payment gateway is NOT being integrated in this phase. Razorpay will be integrated separately in a later phase.

Build real, functional CRUD operations connected to Supabase. Do not create a static dashboard with fake buttons or placeholder functionality.

---

# 1. ADMIN PANEL ARCHITECTURE

Create the following route structure:

/admin/login
/admin
/admin/products
/admin/products/new
/admin/products/[id]
/admin/categories
/admin/orders
/admin/orders/[id]
/admin/customers
/admin/customers/[id]
/admin/inventory
/admin/inventory/history
/admin/promotions
/admin/banners
/admin/content
/admin/pages
/admin/faqs
/admin/reports
/admin/settings
/admin/settings/store
/admin/settings/delivery
/admin/settings/team
/admin/activity-logs

Adapt routes to the existing application where appropriate.

Create a completely separate admin layout.

The admin dashboard must have:

- A professional left sidebar.
- Collapsible sidebar.
- Top navigation/header.
- Main content area.
- Page breadcrumbs.
- Admin profile menu.
- Notification area.
- Responsive mobile sidebar/drawer.
- Consistent tables, forms, dialogs, and cards.

The CMS must be responsive but primarily optimized for desktop and tablet management.

Use a clean, modern SaaS dashboard aesthetic.

## Brand design

Use SuperWalls branding:

- Primary blue: #1556B5
- Accent yellow: #FFC400
- White: #FFFFFF
- Background: #F5F7FA
- Primary text: #172033
- Secondary text: #667085

Use the actual SuperWalls logo where available.

The admin panel should look professional, minimal, modern, and easy to operate.

Avoid excessive gradients, unnecessary animations, oversized cards, and clutter.

Use:
- Tailwind CSS.
- shadcn/ui.
- Lucide React.
- Existing TypeScript architecture.
- Existing component conventions.

Do not introduce a second frontend framework.

---

# 2. ADMIN AUTHENTICATION AND ACCESS CONTROL — CRITICAL

The admin panel must be completely protected.

Customer accounts must never automatically receive administrator permissions.

Use the existing Supabase Auth infrastructure.

Implement proper role-based access control.

Support these roles:

### SUPER ADMIN

Full access to:
- Dashboard.
- Products.
- Categories.
- Orders.
- Customers.
- Inventory.
- Promotions.
- CMS content.
- Reports.
- Business settings.
- Team management.
- Activity logs.

### ADMIN / MANAGER

Access to:
- Dashboard.
- Products.
- Orders.
- Customers.
- Inventory.
- Promotions.
- Reports.
- CMS content.

Restrict sensitive security and team-management operations unless explicitly granted.

### ORDER MANAGER

Access to:
- Dashboard.
- Orders.
- Order details.
- Customer delivery information required to process orders.
- Fulfillment status management.

Cannot manage administrator accounts or sensitive business settings.

### CONTENT MANAGER

Access to:
- Homepage banners.
- CMS pages.
- FAQs.
- Promotional content.
- Product descriptions and images if explicitly permitted.

Cannot manage payments, customer data, or privileged settings.

### INVENTORY MANAGER

Access to:
- Product inventory.
- Stock adjustments.
- Inventory history.
- Low-stock alerts.

Cannot modify payment information or administrator permissions.

Implement permission checks at both the UI and server/database levels.

HIDING SIDEBAR LINKS IS NOT SECURITY.

Use a trusted authorization mechanism.

Recommended approach:
- Dedicated admin_users or admin_members table.
- Role and permission definitions.
- Trusted server-side authorization checks.
- Appropriate RLS policies or tightly scoped server-side operations.

Do not store administrator privileges in user-editable Supabase user_metadata.

Never allow a customer to grant themselves admin access.

Do not implement public admin registration.

Administrator accounts must be created or invited through an authorized super-admin operation or a controlled manual provisioning process.

Create a secure initial super-admin setup guide.

Do not hardcode an admin email, password, or secret in source code.

Add audit logs for sensitive admin actions.

---

# 3. ADMIN DASHBOARD

Build a fully functional dashboard at /admin.

The dashboard should give the business owner a quick overview of the entire SuperWalls business.

## KPI cards

Display:

1. Total revenue.
2. Total orders.
3. Pending orders.
4. Completed orders.
5. Total customers.
6. Active products.
7. Low-stock products.
8. Products out of stock.

Use actual Supabase data.

Do not hardcode numbers.

## Sales analytics

Add a date-range selector:

- Today.
- Yesterday.
- Last 7 days.
- Last 30 days.
- This month.
- Previous month.
- Custom date range.

Display:
- Revenue over time.
- Orders over time.
- Average order value.
- Revenue comparison with the previous period.

Use readable charts.

Use database queries or secure aggregation functions rather than fetching the entire orders table into the browser.

Define revenue carefully. Separate paid, refunded, failed, and pending-payment orders.

Do not count unpaid orders as realized revenue.

## Recent orders

Show:
- Order number.
- Customer.
- Order date.
- Amount.
- Payment status.
- Fulfillment status.

Provide a View All action.

## Additional dashboard sections

- Recent activity.
- Top-selling products.
- Low-stock alerts.
- Recent customer registrations.
- Orders requiring attention.

All metrics must reflect real database data.

---

# 4. PRODUCT MANAGEMENT

Build a comprehensive product management module.

Route: /admin/products

## Product listing

Display a table containing:

- Product image.
- Product name.
- SKU.
- Category.
- Selling price.
- Original price.
- Stock quantity.
- Product status.
- Created date.
- Actions.

Add:
- Search.
- Category filter.
- Active/inactive filter.
- Stock status filter.
- Sorting.
- Pagination.
- Bulk selection.

## Add product

Route: /admin/products/new

Create a professional product creation form.

Fields:

- Product name.
- Slug.
- SKU.
- Short description.
- Full description.
- Product category.
- Selling price.
- Original price / compare-at price.
- Product images.
- Primary image.
- Additional gallery images.
- Stock quantity.
- Low-stock threshold.
- Active/inactive status.
- Featured product toggle.
- SEO title.
- SEO description.

All prices must be stored in integer paise.

Example: ₹199.00 = 19900 paise.

Do not use floating-point arithmetic for authoritative monetary values.

Generate a slug automatically from the product name but allow authorized editing.

Validate duplicate slugs and SKUs.

## Image management

Integrate with the existing Supabase Storage bucket.

Allow:
- Upload product image.
- Upload multiple images.
- Preview images.
- Select primary image.
- Reorder images.
- Remove images.
- Replace images.

Validate file types and file sizes.

Use appropriate Storage permissions.

Do not allow unauthorized customers to upload catalog images.

## Product editing

Allow editing all supported product fields.

Changes should reflect on the customer storefront through Supabase data fetching and appropriate cache revalidation.

## Product actions

- Publish.
- Unpublish.
- Archive.
- Delete when safe.
- Duplicate product.
- Mark as featured.

Never permanently delete products that are referenced by historical orders without handling referential integrity.

Preserve order-item snapshots.

---

# 5. CATEGORY MANAGEMENT

Route: /admin/categories

Implement:

- Create category.
- Edit category.
- Delete category when safe.
- Category name.
- Slug.
- Description.
- Category image.
- Display order.
- Active/inactive status.

Connect categories to the product catalog.

Support a small, simple catalog without unnecessary complex category hierarchies.

Update the storefront category navigation where appropriate.

Prevent deleting categories that contain active products without first resolving their assignments.

---

# 6. ORDER MANAGEMENT — VERY IMPORTANT

Route: /admin/orders

This is one of the most important CMS modules.

Build a detailed order management interface.

## Orders table

Columns:

- Order number.
- Customer name.
- Customer phone.
- Guest / registered customer type.
- Order date.
- Item count.
- Subtotal.
- Delivery fee.
- Discount.
- Total.
- Payment status.
- Fulfillment status.
- Actions.

## Filters

- All orders.
- Pending payment.
- Placed.
- Confirmed.
- Processing.
- Shipped.
- Out for delivery.
- Delivered.
- Cancelled.
- Payment failed.
- Refunded.

Add:
- Search by order number.
- Search by customer name.
- Search by phone number.
- Date range filter.
- Payment status filter.
- Order status filter.
- Pagination.

## Order details

Route: /admin/orders/[id]

Show:

### Customer information
- Customer name.
- Phone number.
- Email.
- Guest or registered status.
- Customer account link when applicable.

### Delivery information
- Complete delivery address.
- PIN code.
- City.
- State.
- Delivery instructions.

### Order items
- Product image.
- Product name.
- SKU if available.
- Quantity.
- Unit price.
- Line total.

### Financial details
- Subtotal.
- Delivery charges.
- Discount.
- Total amount.
- Payment provider.
- Payment status.
- Payment reference, when available.

### Order timeline

Display:
- Order created.
- Payment initiated.
- Payment confirmed.
- Order processing.
- Shipped.
- Out for delivery.
- Delivered.

Only show events supported by actual database records.

## Order status management

Allow authorized administrators to update fulfillment statuses.

Implement controlled status transitions.

For example:

placed → confirmed → processing → shipped → out_for_delivery → delivered

Allow cancellation only through a controlled workflow.

For cancellation:
- Record the reason.
- Prevent arbitrary repeated cancellation.
- Handle inventory reservation or release correctly.
- Do not falsely mark a refund as completed.

Payment status must never be manually changed to paid merely by clicking an admin button.

Actual payment status must eventually be updated through verified payment gateway events.

## Additional order features

- Internal order notes.
- Order activity history.
- Admin activity log.
- Print-friendly order details.
- Export order records where authorized.
- Order search.
- Refresh order information.

Do not implement Razorpay processing in this phase.

---

# 7. CUSTOMER MANAGEMENT

Route: /admin/customers

Build a customer CRM-style management module.

Support both:
- Registered customers.
- Guest customers.

## Customer listing

Display:

- Customer name.
- Email.
- Phone.
- Customer type.
- Total orders.
- Total successful purchase value.
- Last order date.
- Registration date.

Add search and filters.

## Customer details

Show:
- Basic profile information.
- Contact details.
- Saved delivery addresses where authorized.
- Order history.
- Total completed purchases.
- Last order.
- Customer activity.

For guest customers, show order-associated customer snapshots.

Do not expose sensitive authentication information.

Do not expose password hashes, authentication tokens, payment credentials, or private internal metadata.

Do not allow administrators to log in as customers or change customer passwords directly.

Support only authorized profile corrections.

---

# 8. INVENTORY MANAGEMENT

Route: /admin/inventory

Create a separate inventory management module.

## Inventory overview

Display:
- Total active products.
- Available stock.
- Low-stock items.
- Out-of-stock items.
- Reserved stock.
- Stock movements.

## Inventory table

Show:
- Product image.
- Product name.
- SKU.
- Current physical stock.
- Reserved stock.
- Available stock.
- Low-stock threshold.
- Inventory status.

Use the formula:

Available stock = Physical stock - Active reserved stock.

Ensure consistency with the existing order/payment inventory reservation architecture.

## Stock adjustments

Allow authorized inventory managers to:

- Increase stock.
- Decrease stock.
- Record stock corrections.
- Add an adjustment reason.
- View adjustment history.

Do not silently overwrite stock values.

Create an inventory_movements table or adapt an existing equivalent.

Record:
- Product ID.
- Previous quantity.
- Adjustment quantity.
- New quantity.
- Adjustment reason.
- Admin user ID.
- Timestamp.
- Related order/reservation when applicable.

Use atomic database operations to prevent race conditions.

Never let a manual stock adjustment invalidate active reservations without explicit handling.

## Alerts

Highlight:
- Low-stock products.
- Out-of-stock products.
- Products with active reservations.
- Products requiring attention.

Allow the administrator to configure low-stock thresholds.

---

# 9. PROMOTION AND COUPON MANAGEMENT

Route: /admin/promotions

Build a promotion management module.

Allow authorized users to create and manage discount codes.

Fields:

- Coupon code.
- Description.
- Discount type.
- Percentage discount.
- Fixed discount amount.
- Minimum order amount.
- Maximum discount.
- Start date.
- Expiry date.
- Maximum total usage.
- Maximum usage per customer.
- Active/inactive status.

Support:
- Create coupon.
- Edit coupon.
- Activate/deactivate.
- Delete when unused.
- View usage history.

Use integer paise for monetary values.

Validate coupon eligibility on the trusted backend.

Never trust discount values submitted by the frontend.

Prevent:
- Expired coupon use.
- Inactive coupon use.
- Usage-limit bypass.
- Duplicate coupon redemption.
- Discount exceeding applicable order value.

Do not create fake promotional claims.

Keep the coupon system compatible with the future payment integration.

---

# 10. HOMEPAGE AND CONTENT MANAGEMENT SYSTEM

Route: /admin/content

This is the actual CMS portion of the application.

The administrator should be able to update the customer storefront without editing source code.

## A. Homepage banners

Allow:

- Create banner.
- Upload banner image.
- Desktop image.
- Mobile image.
- Heading.
- Subtitle.
- CTA label.
- CTA destination.
- Display order.
- Active/inactive status.
- Start date.
- End date.

Support multiple homepage banners.

Provide preview functionality.

## B. Homepage sections

Allow the admin to manage:

- Hero section content.
- Promotional strip.
- Featured products.
- Brand introduction.
- Why choose SuperWalls.
- Customer benefits.
- Contact/support section.

Allow section visibility and display ordering.

Do not create a complicated drag-and-drop page builder unless necessary.

Prefer structured, controlled CMS sections.

## C. Static pages

Route: /admin/pages

Allow administrators to manage:

- About Us.
- Contact Us.
- Privacy Policy.
- Terms and Conditions.
- Shipping Policy.
- Refund and Cancellation Policy.

Support:
- Page title.
- URL slug.
- Page content.
- SEO title.
- SEO description.
- Draft/published status.
- Updated timestamp.

Use a safe rich-text editor or controlled Markdown editor.

Sanitize rendered HTML and prevent XSS.

## D. FAQ management

Route: /admin/faqs

Allow:
- Create FAQ.
- Edit FAQ.
- Delete FAQ.
- Question.
- Answer.
- Category.
- Display order.
- Active/inactive status.

Connect FAQs to the customer-facing website.

## E. Footer management

Allow management of:
- Footer description.
- Contact information.
- Useful links.
- Policy links.
- Social media links.
- Copyright text.

Do not invent company contact details.

---

# 11. BUSINESS SETTINGS

Route: /admin/settings

Create a structured settings area.

## Store settings

Fields:
- Business name.
- Logo.
- Tagline.
- Contact email.
- Contact phone.
- Business address.
- Website URL.
- Currency.
- Timezone.

Defaults:
- Brand: SuperWalls.
- Currency: INR.
- Timezone: Asia/Kolkata.

## Delivery settings

Allow authorized administrators to configure:

- Standard delivery charge.
- Free delivery threshold.
- Minimum order value.
- Delivery availability by PIN code.
- Serviceable cities/areas.
- Delivery policy text.

Keep these settings consistent with the existing checkout pricing service.

The checkout must obtain delivery charges from trusted backend logic.

Never calculate authoritative delivery charges solely in the browser.

## Contact settings

Allow:
- Customer support phone.
- Customer support email.
- WhatsApp business number.
- Support availability information.

Prepare the WhatsApp integration configuration for future use.

Do not send WhatsApp messages in this phase.

## Notification settings

Prepare configuration for future notifications:
- Order confirmation.
- Order processing.
- Shipping updates.
- Delivery updates.
- Low-stock alerts.

Do not claim email or WhatsApp notifications are active unless actually integrated.

---

# 12. REPORTS AND ANALYTICS

Route: /admin/reports

Build useful business reports.

Include:

## Sales report
- Total paid revenue.
- Order count.
- Average order value.
- Daily sales.
- Monthly sales.
- Date range filtering.

## Product report
- Best-selling products.
- Units sold.
- Product revenue.
- Low-performing products.

## Order report
- Total orders.
- Delivered orders.
- Cancelled orders.
- Pending orders.
- Payment failures.

## Customer report
- Total registered customers.
- Guest customers.
- Repeat customers.
- New customers by period.

## Inventory report
- Current stock.
- Low-stock products.
- Out-of-stock products.
- Inventory adjustments.

Support CSV export for authorized users.

IMPORTANT:

Use correct financial definitions.

- Paid revenue should exclude pending and failed payments.
- Refunded amounts must be accounted for.
- Cancelled unpaid orders must not count as revenue.
- Avoid counting duplicate payment events.
- Do not use order totals as realized revenue without checking payment status.

Use secure database aggregations and appropriate indexes.

---

# 13. ADMIN TEAM MANAGEMENT

Route: /admin/settings/team

Super-admin only.

Allow:
- Invite administrator.
- Assign roles.
- Change roles.
- Suspend administrator access.
- Revoke access.
- View team members.
- View invitation status.

Do not implement public admin registration.

Do not allow administrators to grant themselves higher permissions.

Do not allow the last active super-admin to be accidentally removed or demoted.

Use trusted server-side operations.

Keep team invitations separate from customer registration.

---

# 14. ACTIVITY AND AUDIT LOGS

Route: /admin/activity-logs

Build an audit log system.

Record sensitive operations:

- Admin login.
- Product created.
- Product edited.
- Product published/unpublished.
- Product deleted/archived.
- Stock adjusted.
- Order status updated.
- Order cancelled.
- Coupon created/modified.
- CMS content changed.
- Settings updated.
- Admin role changed.

Each event should contain:

- Actor admin ID.
- Action.
- Entity type.
- Entity ID.
- Timestamp.
- Relevant before/after metadata where appropriate.

Do not store passwords, access tokens, payment secrets, or unnecessary customer personal information in logs.

Audit logs should not be editable or deletable by ordinary administrators.

---

# 15. SUPABASE DATABASE INTEGRATION

Inspect the existing Supabase database before creating migrations.

Reuse existing tables wherever appropriate.

Potential CMS-related tables:

- admin_users or admin_members.
- product_categories.
- inventory_movements.
- promotions.
- promotion_redemptions.
- homepage_banners.
- cms_sections.
- cms_pages.
- faqs.
- store_settings.
- delivery_settings.
- admin_activity_logs.

Only create tables that are actually needed.

Add appropriate:
- Foreign keys.
- Unique constraints.
- Check constraints.
- Indexes.
- Timestamps.
- RLS policies.

Do not create redundant versions of existing products, orders, profiles, or payments tables.

All database changes must be delivered as version-controlled SQL migrations.

Never use destructive migrations without inspecting dependencies and preserving existing data.

---

# 16. SUPABASE SECURITY AND AUTHORIZATION

Security is a priority.

Enable and correctly configure RLS for all CMS-related tables.

Rules:

- Public users cannot access admin records.
- Customers cannot read CMS administrative information.
- Only authorized administrators can manage catalog content.
- Only authorized roles can modify orders.
- Only inventory-authorized roles can adjust stock.
- Only super-admins can manage administrator accounts.
- Sensitive settings are protected.
- Audit records cannot be modified by unauthorized users.

All privileged actions must be validated server-side.

Never rely on the frontend to enforce roles.

Never expose service-role keys in browser code.

If privileged Supabase operations are required, isolate them in server-only modules and validate the requesting administrator's identity and permissions before executing them.

Use secure authorization helpers and document the access-control architecture.

---

# 17. CUSTOMER STOREFRONT SYNCHRONIZATION

Every relevant CMS change must reflect on the customer storefront.

Examples:

- Publishing a product makes it visible on the storefront.
- Unpublishing a product removes it from public browsing.
- Updating a product price updates the storefront price.
- Updating a product image updates the product display.
- Publishing a banner updates the homepage.
- Updating FAQs changes the FAQ page.
- Updating policies changes the relevant website pages.
- Changing delivery configuration affects checkout pricing.

Implement appropriate Next.js cache revalidation or fresh data fetching.

Do not leave the storefront showing stale product or content data after an admin update.

Ensure cached content never leaks private customer information.

---

# 18. ADMIN UX AND INTERACTION REQUIREMENTS

Every module must have:

- Loading states.
- Empty states.
- Error states.
- Success feedback.
- Form validation.
- Confirmation dialogs for destructive actions.
- Search and filters where useful.
- Pagination for larger datasets.
- Responsive tables.
- Clear action buttons.
- Permission-based access.

Use reusable components.

Examples:

- DataTable.
- StatusBadge.
- ConfirmDialog.
- ProductForm.
- ImageUploader.
- SearchFilter.
- DateRangePicker.
- MetricCard.
- OrderTimeline.
- Pagination.
- PermissionGuard.

Avoid duplicating business logic across pages.

Use proper TypeScript types.

Do not use `any` unnecessarily.

All buttons must perform their advertised action.

Do not build decorative, nonfunctional dashboard elements.

---

# 19. DEVELOPMENT AND IMPLEMENTATION STRATEGY

Work in this order:

PHASE A:
Inspect the existing application, Supabase schema, authentication, RLS, and service architecture.

PHASE B:
Design the admin architecture, route protection, role-based access, and database migrations.

PHASE C:
Implement the admin layout, sidebar, topbar, login, and dashboard.

PHASE D:
Implement product and category management.

PHASE E:
Implement order and customer management.

PHASE F:
Implement inventory and promotions.

PHASE G:
Implement CMS content management.

PHASE H:
Implement business settings, reports, team management, and audit logs.

PHASE I:
Connect all admin changes to the existing customer storefront.

PHASE J:
Test permissions, database operations, security, and production build.

Do not stop after generating a dashboard screenshot.

Complete the functional modules.

---

# 20. TESTING AND ACCEPTANCE CRITERIA

Test the following:

AUTHORIZATION:
- Unauthenticated users cannot access /admin.
- Regular customers cannot access admin pages.
- Order managers cannot access super-admin settings.
- Inventory managers cannot change payment statuses.
- Content managers cannot access customer financial data.
- Super-admin can access authorized modules.
- Users cannot promote themselves to administrator.

PRODUCTS:
- Create product.
- Edit product.
- Upload images.
- Publish/unpublish product.
- Change pricing.
- Verify storefront synchronization.

ORDERS:
- View actual orders.
- View guest orders.
- View registered customer orders.
- Update allowed fulfillment statuses.
- Record cancellation reasons.
- Preserve payment security.

INVENTORY:
- Adjust stock.
- View stock history.
- Prevent overselling.
- Preserve active stock reservations.

CMS:
- Create banner.
- Publish banner.
- Update homepage content.
- Publish FAQ.
- Update policy page.
- Verify changes on storefront.

REPORTS:
- Verify revenue calculations.
- Verify order totals.
- Verify refunds are accounted for.
- Verify date filters.

SECURITY:
- Test RLS.
- Test role-based permissions.
- Test direct unauthorized API requests.
- Test server-side validation.
- Verify privileged credentials are not exposed.

Run:
- Production build.
- TypeScript checks.
- Lint checks.
- Available automated tests.

Do not claim a test passed unless you actually ran it.

---

# 21. IMPORTANT: RAZORPAY IS NOT PART OF THIS PHASE

The payment gateway will be integrated separately.

For now:

- Build payment information display only.
- Display the existing payment status from the database.
- Display available payment references if authorized.
- Keep the architecture compatible with future Razorpay integration.
- Do not create payment sessions.
- Do not implement payment verification.
- Do not create fake refund functionality.
- Do not mark orders as paid through the admin CMS.

Payment status must remain controlled by trusted backend payment verification.

---

# 22. FINAL DELIVERABLES

Provide:

1. Complete functional SuperWalls Admin CMS.
2. Separate admin login and protected routes.
3. Role-based access control.
4. Admin dashboard and analytics.
5. Product management.
6. Category management.
7. Order management.
8. Customer management.
9. Inventory management.
10. Promotions and coupons.
11. Homepage banner management.
12. CMS pages and FAQ management.
13. Business settings.
14. Reports and CSV exports.
15. Admin team management.
16. Audit logs.
17. SQL migrations.
18. RLS policies.
19. Updated README.
20. Initial super-admin provisioning instructions.
21. Testing results.
22. Outstanding configuration requirements.

The finished CMS must be fully connected to the existing Supabase backend.

FINAL QUALITY REQUIREMENT:

The result should feel like a professional, custom-built e-commerce management system for a real business.

The business owner should be able to operate SuperWalls entirely through this CMS without needing to open the code editor or manually edit the database for routine business operations.

Prioritize security, ease of operation, accurate business data, and maintainability over unnecessary complexity.