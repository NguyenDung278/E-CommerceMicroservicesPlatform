# Catalog Importer

CLI dùng để đọc workbook `.xlsx` và import dữ liệu catalog/editorial vào `product-service`.

## Chế độ hỗ trợ

- `dry-run`: parse, validate, chạy toàn bộ transaction rồi rollback.
- `commit`: parse, validate, ghi dữ liệu vào PostgreSQL.

## Cách chạy

Từ thư mục `services/product-service`:

```bash
go run ./cmd/catalog-importer \
  -workbook ../../artifacts/import-templates/catalog-import-sample-workbook.xlsx \
  -mode dry-run
```

```bash
go run ./cmd/catalog-importer \
  -workbook ../../artifacts/import-templates/catalog-import-sample-workbook.xlsx \
  -mode commit
```

Hoặc từ root repo:

```bash
make storefront-import-dry-run
make storefront-import-sample
```

## Những gì CLI đang làm

- validate workbook có đúng sheet/header yêu cầu
- validate JSON/timestamp/number/bool
- chặn duplicate quan trọng như `category_aliases.alias`, `products.external_id`, `variants.sku`
- upsert:
  - `categories`
  - `category_aliases`
  - `products`
  - `editorial_sections`
  - `featured_products`
- map sheet `variants` vào cột JSONB `products.variants` hiện có thay vì tạo bảng variants riêng

## Ghi chú

- `products.external_id`, `products.category_slug`, `products.material`, `products.merchandising_rank` được thêm qua migration mới.
- `variants` là sheet optional. Nếu có dữ liệu, importer sẽ đồng bộ sang `products.variants`, `image_url`, `image_urls`.
- `dry-run` vẫn có thể chạy migration nếu dùng `-migrate=true` để đảm bảo schema tồn tại.
