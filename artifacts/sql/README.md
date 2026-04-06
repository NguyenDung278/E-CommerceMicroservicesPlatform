# SQL Artifacts

These SQL files support local storefront troubleshooting and sample-data maintenance.

## Files

- `storefront-reset-sample.sql`: repairs and resets sample storefront data before re-importing workbook content.
- `storefront-explain-home.sql`: runs `EXPLAIN ANALYZE` for key storefront home queries.

## Usage

The `Makefile` already wires these scripts into helper targets:

```bash
make storefront-reset-sample
make storefront-explain-home
```
