# Artifacts

This directory stores supporting development artifacts rather than production application code.

## Layout

- `import-templates/`: sample catalog import workbook inputs and the script used to generate the workbook.
- `sql/`: SQL helpers for resetting sample storefront data and inspecting storefront query plans.

## Maintenance

- Keep generated caches such as `__pycache__` out of version control.
- Preserve workbook and SQL paths that are referenced by the `Makefile`, docs, or importer tests.
