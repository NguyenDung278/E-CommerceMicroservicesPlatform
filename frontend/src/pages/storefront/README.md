# Storefront Pages

Customer-facing commerce screens live here: home, catalog, category landing pages, product detail,
wishlist, cart, and checkout. These pages should stay thin: they orchestrate feature hooks,
providers, and shared components, but should not become a second API layer or a place for hidden
business rules.

## What belongs in this folder

- Route-level orchestration and page layout.
- UI state that is local to a page surface.
- Composition of `features/`, `components/`, and `services/api`.
- Navigation and conversion flow between browse -> save -> cart -> checkout.

## What should stay elsewhere

- Server I/O and response normalization: `frontend/src/services/api/`
- Cross-page cart and wishlist state: `frontend/src/features/cart/`, `frontend/src/features/wishlist/`
- Category/archive listing logic: `frontend/src/features/storefront/`
- Shared product cards and form primitives: `frontend/src/components/`

## Storefront page map

- `home-page.tsx`: editorial landing surface driven by workbook content and live product sync.
- `catalog-page.tsx`: full archive with filtering, pagination, and storefront listing helpers.
- `category-page.tsx`: richer category storytelling surface for Men, Women, Footwear, Accessories.
- `product-detail-page.tsx`: variant selection, gallery, wishlist/save actions, reviews, and buy flow.
- `wishlist-page.tsx`: saved-item shortlist and bridge back into cart/product detail.
- `cart-page.tsx`: quantity management, coupon preview, and checkout handoff.
- `checkout-page.tsx`: delivery contact, shipping, payment selection, and order submission.

## Reading order if you are improving the fashion-app UX

1. `app/layout/app-layout.tsx` for shell navigation, wishlist/cart badges, and route framing.
2. `product-detail-page.tsx` for buy-now, variant, and gallery flow.
3. `wishlist-page.tsx` for saved-item UX and return-to-purchase behavior.
4. `cart-page.tsx` and `checkout-page.tsx` for conversion friction and mobile CTA polish.
5. `features/cart/` and `features/wishlist/` for shared state and optimistic interactions.

## Practical rules for keeping storefront code clear

- Keep page files focused on orchestration; extract repeated transformation logic into small helpers.
- Prefer naming that matches the customer journey: `savedProducts`, `selectedVariant`,
  `checkoutItems`, `deliveryPromise`.
- Let `services/api/normalizers.ts` stay the single place that cleans backend payloads.
- Avoid mixing page layout concerns with provider persistence details.
- If a UI change depends on auth/cart/wishlist behavior, verify both guest and authenticated flows.
