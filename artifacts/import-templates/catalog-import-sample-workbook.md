## `categories`

| slug | display_name | nav_label | status | hero | filter_config | seo | created_at | updated_at |
|---|---|---|---|---|---|---|---|---|
| shop-men | Shop Men | Men | active | {"variant":"dark-immersive","title":"Men's Atelier","imageUrl":"https://example.com/editorial/shop-men-hero.jpg"} | [{"key":"size","kind":"sizes"},{"key":"material","kind":"list"},{"key":"price","kind":"price"}] | {"title":"Men's Collection","description":"Shop the latest men's apparel"} | 2025-09-26 10:00:00 | 2025-09-26 10:00:00 |
| atelier-women | Atelier Women | Women | active | {"variant":"light-editorial","title":"Women's Atelier","imageUrl":"https://example.com/editorial/atelier-women-hero.jpg"} | [{"key":"size","kind":"sizes"},{"key":"color","kind":"palette"}] | {"title":"Women's Atelier","description":"Discover refined silhouettes and seasonal edits"} | 2025-09-26 10:05:00 | 2025-09-26 10:05:00 |

Constraints:
- `slug` is the primary key and must be unique.
- `display_name`, `nav_label`, `status`, `hero`, `filter_config`, `seo`, `created_at`, and `updated_at` are `NOT NULL`.
- `status` defaults to `active` when omitted.
- `hero`, `filter_config`, and `seo` must be valid JSON strings in Excel and parsed before insert.

Zod Mapping:
- Parse `hero`, `filter_config`, and `seo` with `JSON.parse` before building SQL parameters.

## `category_aliases`

| category_slug | alias |
|---|---|
| shop-men | Shop Men |
| shop-men | men |
| shop-men | mens |
| atelier-women | Atelier Women |
| atelier-women | women-atelier |

Constraints:
- `category_slug` is a foreign key to `categories.slug`.
- `alias` is `NOT NULL` and must be unique across the workbook and database.
- Every `category_slug` value must exist in the `categories` sheet before import.

## `products`

| id | external_id | name | category_slug | category | price | stock | material | merchandising_rank | updated_at |
|---|---|---|---|---|---|---|---|---|---|
| 550e8400-e29b-41d4-a716-446655440000 | SM-001 | Linen Shirt | shop-men | shop-men | 129.99 | 18 | Italian Linen | 1 | 2025-09-26 10:00:00 |
| 550e8400-e29b-41d4-a716-446655440001 | SM-002 | Cotton Tee | shop-men | shop-men | 49.99 | 42 | Organic Cotton | 2 | 2025-09-26 10:00:00 |
| 550e8400-e29b-41d4-a716-446655440002 | AW-001 | Silk Dress | atelier-women | atelier-women | 229.00 | 7 | Mulberry Silk | 1 | 2025-09-26 10:05:00 |

Constraints:
- `id` is the primary key. If the database uses `gen_random_uuid()`, the importer may ignore blank `id` cells and let the database generate them.
- `external_id` is `NOT NULL` and must be unique.
- `name`, `price`, `stock`, `material`, `merchandising_rank`, and `updated_at` are `NOT NULL`.
- `category_slug` must reference `categories.slug`.
- `category` is the legacy backward-compatible value and should mirror `category_slug` for the current importer flow.
- `price` must be numeric and `stock` must be a non-negative integer.
- `material` defaults to an empty string and `merchandising_rank` defaults to `0` when omitted.

Zod Mapping:
- `ProductRow` validates `external_id`, `name`, `category_slug`, `price`, and `stock`.
- SQL parameter order is `external_id`, `name`, `category_slug`, `category_slug`, `price`, `stock`.

## `variants` (optional)

| id | product_external_id | sku | size | color | stock | price | image_url |
|---|---|---|---|---|---|---|---|
| 660e8400-e29b-41d4-a716-446655440000 | SM-001 | SM-001-M | M | White | 10 | 129.99 | https://example.com/images/sm001-m.jpg |
| 660e8400-e29b-41d4-a716-446655440001 | SM-001 | SM-001-L | L | White | 8 | 129.99 | https://example.com/images/sm001-l.jpg |
| 660e8400-e29b-41d4-a716-446655440002 | SM-002 | SM-002-S | S | Navy | 42 | 49.99 | https://example.com/images/sm002-s.jpg |

Constraints:
- `id` is the primary key. If the database generates UUIDs, the importer may ignore blank `id` cells.
- `product_external_id` must reference `products.external_id`.
- `sku` is `NOT NULL` and should be unique per variant row.
- `stock` is `NOT NULL` and must be a non-negative integer.
- `price` should be numeric when supplied.
- `image_url` should be a valid absolute URL when supplied.

## `editorial_sections`

| id | category_slug | section_type | position | payload | published |
|---|---|---|---|---|---|
| 770e8400-e29b-41d4-a716-446655440000 | shop-men | hero-banner | 1 | {"variant":"dark-immersive","title":"Spring Drop","subtitle":"New arrivals"} | true |
| 770e8400-e29b-41d4-a716-446655440001 | shop-men | product-grid | 2 | {"columns":3,"productIds":["SM-001","SM-002"]} | true |
| 770e8400-e29b-41d4-a716-446655440002 | atelier-women | story-block | 1 | {"heading":"Craftsmanship","body":"Hand-stitched details"} | true |

Constraints:
- `id` is the primary key. If the database generates UUIDs, the importer may ignore blank `id` cells.
- `category_slug` must reference `categories.slug`.
- `section_type`, `position`, `payload`, and `published` are `NOT NULL`.
- `position` must be an integer and should be unique within the same `category_slug` if display order matters.
- `payload` must be a valid JSON string in Excel and parsed before insert.
- `published` defaults to `true` when omitted.

Zod Mapping:
- Read `payload` as a string and parse it with `JSON.parse` before insert.

## `featured_products` (optional)

| id | product_external_id | category_slug | position |
|---|---|---|---|
| 880e8400-e29b-41d4-a716-446655440000 | SM-001 | shop-men | 1 |
| 880e8400-e29b-41d4-a716-446655440001 | AW-001 | atelier-women | 1 |

Constraints:
- `id` is the primary key. If the database generates UUIDs, the importer may ignore blank `id` cells.
- `product_external_id` must reference `products.external_id`.
- `category_slug` must reference `categories.slug`.
- `position` is `NOT NULL` and should be an integer.
- A product should not appear twice with the same `category_slug` and `position`.
