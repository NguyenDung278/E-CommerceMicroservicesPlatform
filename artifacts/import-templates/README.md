# Import Templates

This folder contains the sample catalog import workbook, the CSV source rows behind that workbook, and the Python helper used to regenerate it.

## Files

- `catalog-import-sample-workbook.xlsx`: tracked sample workbook used by docs, tests, and `make storefront-import-sample`.
- `csv_data/`: source CSV files for categories, aliases, products, variants, editorial sections, and featured products.
- `dataset.py`: loads sheet data from `csv_data/`.
- `xml_templates.py`: low-level XML builders for workbook generation.
- `generate_catalog_import_sample_workbook.py`: regenerates the sample workbook from the CSV source files.

## Usage

Run the generator from the repo root or from this directory:

```bash
python3 artifacts/import-templates/generate_catalog_import_sample_workbook.py
```

## Cleanup

- Python cache files are intentionally ignored here.
- Keep the workbook filename stable unless you also update the `Makefile`, importer docs, and importer tests.
