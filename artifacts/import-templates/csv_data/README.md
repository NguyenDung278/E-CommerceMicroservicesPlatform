# CSV Template Data

Each CSV file in this folder maps to one sheet in the sample catalog import workbook.

## Sheet Order

1. `categories.csv`
2. `category_aliases.csv`
3. `products.csv`
4. `variants.csv`
5. `editorial_sections.csv`
6. `featured_products.csv`

## Guidance

- Keep headers stable so `dataset.py` can load rows without custom mapping changes.
- Treat these files as the editable source of truth for the sample workbook.
- To regenerate the seeded CSV set from the shared catalog definitions, run `node artifacts/import-templates/generate_catalog_import_sample_data.mjs`.
- Regenerate `catalog-import-sample-workbook.xlsx` after changing the CSV rows.
