This is the Next.js storefront client for the ND Shop repository.

## Purpose

This app is the official storefront/account/admin runtime for the repository. Shopper flows and the product admin flow now share the same localhost at `http://127.0.0.1:3000`.

## Getting started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the production standalone bundle:

```bash
npm run build
```

Start the production standalone server:

```bash
npm run start
```

The build and start scripts now prepare `.next/standalone` with the required
`.next/static` and `public` assets automatically, so local production smoke
tests no longer need a manual copy step.

## Current scope

- App Router
- TypeScript
- ESLint
- `src/` directory layout
- Storefront/account flows backed by the shared Go services, including a dedicated `/wishlist` route
- Nested admin flow at `/admin/orders`, `/admin/products`, `/admin/inventory`, `/admin/reports` for admin/staff users

## UI blueprint

### Product direction

This app should follow one simple rule:

- storefront only shows information that helps a customer discover, compare, add to cart, and pay
- admin only shows information that helps staff manage catalog, orders, inventory, and reports

Do not rebuild the client into a content-heavy marketplace clone. Borrow the information architecture of apps like Tiki, Lazada, Shopify Admin, and Amazon Seller Central, but remove campaign noise, voucher clutter, and non-operational surfaces unless the repository has real backend support for them.

### Runtime source of truth

- `client/` is the official UI runtime for shoppers, account flows, and admin flows.
- `frontend/` is now legacy UI code. Do not continue feature work there unless a blocker forces it.
- Docker Compose and local production smoke tests should target `client/`.

### Route decisions

#### Storefront routes to keep as first-class

| Route | Keep? | Role |
| --- | --- | --- |
| `/` | Yes | storefront landing page with search, categories, live catalog snapshot |
| `/products` | Yes | primary catalog page |
| `/products/[productId]` | Yes | product detail and purchase page |
| `/cart` | Yes | live cart with stock and price reconciliation |
| `/checkout` | Yes | single checkout flow |
| `/orders/[orderId]` | Yes | post-purchase detail page |

#### Storefront routes to keep but demote

| Route | Decision | Notes |
| --- | --- | --- |
| `/profile` | Keep | account hub, not part of primary buying nav |
| `/myorders` | Keep | account order list |
| `/addresses` | Keep | checkout support surface |
| `/security` | Keep | account maintenance only |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/callback` | Keep | auth boundary |

#### Storefront routes to merge or redirect

| Route | Decision | Target shape |
| --- | --- | --- |
| `/catalog` | Merge into `/products` | keep temporary redirect or alias only |
| `/categories/[categoryName]` | Merge into `/products?category=` | keep route only as compatibility layer |
| `/product/[slug]` | Redirect | redirect to `/products/[productId]` or canonical product URL |

#### Storefront routes to remove from main navigation

These can still exist temporarily, but they should not appear in the top-level buying navigation:

- `/wishlist`
- `/notifications`
- `/payments`
- `/returns`
- `/returns/[returnId]`
- `/order-confirmation`

Reason:

- they are post-purchase or account-support surfaces
- they add noise to the main sales flow
- they should be reachable from account or deep links, not from the storefront primary nav

### Admin route blueprint

Current `/admin` should evolve into a nested admin surface:

| Route | Role | Default priority |
| --- | --- | --- |
| `/admin` | redirect to `/admin/orders` or `/admin/products` | high |
| `/admin/orders` | order queue and fulfillment actions | highest |
| `/admin/products` | product CRUD and merchandising basics | highest |
| `/admin/inventory` | stock operations and low-stock handling | highest |
| `/admin/reports` | revenue, AOV, order status, top products | high |

Do not add first-class top-level admin sections for:

- users
- coupons
- notifications
- returns
- payments

until the core four surfaces above are clean and stable. Those features can live behind drill-down actions inside Orders or Reports if needed.

### Screen blueprint

#### Storefront `/`

Structure:

1. sticky header
2. large search field
3. category shortcuts
4. live product grid
5. compact trust strip

Do not add:

- giant carousel stacks
- editorial storytelling blocks
- unrelated account shortcuts
- metrics that customers do not care about

#### Storefront `/products`

Structure:

1. search
2. category filter
3. sort
4. result count
5. paginated or cursor-fed product grid

Card content should stop at:

- image
- product name
- category
- price
- stock state
- `Add to cart`
- `Buy now`

#### Storefront `/products/[productId]`

Structure:

1. gallery
2. product summary
3. variant selector
4. quantity stepper
5. live stock/price box
6. `Add to cart` and `Buy now`
7. secondary detail below the fold

Move anything non-essential below the purchase panel.

#### Storefront `/cart`

Structure:

1. item list
2. quantity and remove actions
3. live reconciliation state
4. sticky order summary
5. primary CTA to checkout

#### Storefront `/checkout`

Structure:

1. shipping address
2. shipping method
3. payment method
4. live order summary
5. place order

No side quests inside checkout.

#### Admin `/admin/orders`

Structure:

1. analytics bar
2. search and status filters
3. order list
4. order detail drawer or side panel
5. actions: cancel, reconcile, inspect payment, inspect timeline

This screen should be the operational default once order volume increases.

#### Admin `/admin/products`

Structure:

1. analytics bar
2. search and status filters
3. product table or dense card list
4. create/edit product form
5. publish/unpublish actions

Do not overload this page with promotions, coupons, or customer management.

#### Admin `/admin/inventory`

Structure:

1. low-stock summary
2. prioritized inventory list
3. inline quantity update
4. out-of-stock and inactive listing warnings

This page should optimize speed of stock operations, not visual storytelling.

#### Admin `/admin/reports`

Structure:

1. date range selector
2. KPI tiles
3. order status breakdown
4. top product list
5. revenue and AOV summaries

Keep this operational. If a report does not change a decision, do not surface it.

### Target component tree

Storefront and admin are now both split by domain. `storefront-pages/*.tsx` should be treated as migration wrappers only.

#### Current structure

```text
client/src/components/
  storefront/
    storefront-shared.ts
    catalog/
      catalog-page.tsx
      catalog-filters.tsx
      catalog-results.tsx
      catalog-shared.ts
    product/
      product-page.tsx
      product-gallery.tsx
      product-purchase-panel.tsx
      product-sync-panel.tsx
    cart/
      cart-page.tsx
      cart-items-list.tsx
      cart-summary.tsx
    checkout/
      checkout-page.tsx
      checkout-shared.ts
      checkout-recipient-section.tsx
      checkout-shipping-section.tsx
      checkout-payment-section.tsx
      checkout-order-summary.tsx
  admin/
    admin-layout.tsx
    admin-console-context.tsx
    admin-shared.tsx
    admin-orders-page.tsx
    admin-inventory-page.tsx
    admin-reports-page.tsx
  storefront-pages/
    home-page.tsx
    catalog-page.tsx
    product-page.tsx
    cart-page.tsx
    checkout-page.tsx
```

### Page wiring blueprint

Recommended `app/` structure after cleanup:

```text
client/src/app/
  page.tsx
  products/page.tsx
  products/[productId]/page.tsx
  cart/page.tsx
  checkout/page.tsx
  profile/page.tsx
  myorders/page.tsx
  addresses/page.tsx
  security/page.tsx
  admin/page.tsx
  admin/orders/page.tsx
  admin/products/page.tsx
  admin/inventory/page.tsx
  admin/reports/page.tsx
```

Compatibility routes can stay during migration:

- `/catalog`
- `/categories/[categoryName]`
- `/product/[slug]`

but they should forward into the canonical pages above.

### Data and hook boundaries

Recommended hook split:

```text
client/src/hooks/
  storefront/
    use-live-catalog.ts
    use-live-product.ts
    use-live-cart.ts
  admin/
    use-admin-dashboard.ts
    use-admin-orders.ts
    use-admin-products.ts
    use-admin-inventory.ts
    use-admin-reports.ts
```

Rules:

- live sync logic should not be reimplemented separately in each page
- polling intervals and focus-refresh behavior should live in reusable hooks
- page components should assemble data and layout, not own all fetching logic inline

### Existing files that should be treated as transitional

- `client/src/components/admin-products-page.tsx`
  - now acts as the products domain page only
  - should eventually move under `client/src/components/admin/products/` if the admin surface needs another level of split
- `client/src/components/storefront-pages/*.tsx`
  - now act as migration wrappers
  - should stay thin and only delegate into `client/src/components/storefront/*`
- `frontend/`
  - should be treated as legacy until parity is complete and then removed from active UI ownership

### Suggested implementation order

1. Freeze `frontend/` as legacy.
2. Introduce nested admin routes under `client/src/app/admin/`.
3. Split `admin-products-page.tsx` into `orders`, `products`, `inventory`, `reports`.
4. Keep `storefront-pages` as thin wrappers and continue extracting any leftover shared behavior into `client/src/components/storefront/*`.
5. Remove non-essential storefront links from primary navigation.
6. Convert compatibility routes into redirects or thin wrappers.
7. After parity, deprecate `frontend/` from docs and local runtime defaults.

## Runtime notes

- `npm run dev` serves the host-based client at `http://127.0.0.1:3000`
- `npm run start` serves the standalone production build from `.next/standalone`
- `make client-build` and `make client-start` are available from the repo root
- Docker Compose now runs this app by default as the single UI surface
- backend redirects and payment return URLs should point at `http://localhost:3000`

## References

- [Next.js documentation](https://nextjs.org/docs)
