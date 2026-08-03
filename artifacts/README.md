# Artifacts

This directory stores supporting development artifacts rather than production application code.

## Layout

- `import-templates/`: sample catalog import workbook inputs and the script used to generate the workbook.
- `sql/`: SQL helpers for resetting sample storefront data and inspecting storefront query plans.
- `scripts/`: one-off maintenance scripts run against a local stack. `prune-legacy-carts.sh` drops cart lines
  that predate per-variant checkout (no `sku` on a product that declares variants); it defaults to a dry run
  and only writes with `--apply`.

## Maintenance

- Keep generated caches such as `__pycache__` out of version control.
- Preserve workbook and SQL paths that are referenced by the `Makefile`, docs, or importer tests.
