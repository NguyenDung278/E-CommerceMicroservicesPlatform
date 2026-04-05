#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

# Ensure the script directory is in system path to allow relative imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

from dataset import SHEETS
from xml_templates import (
    app_xml,
    content_types_xml,
    core_xml,
    root_rels_xml,
    sheet_xml,
    styles_xml,
    workbook_rels_xml,
    workbook_xml,
)

OUTPUT_PATH = Path(__file__).resolve().parent / "catalog-import-sample-workbook.xlsx"


def build_workbook() -> None:
    sheets_count = len(SHEETS)
    sheet_names = [name for name, _, _ in SHEETS]

    with ZipFile(OUTPUT_PATH, "w", compression=ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml(sheets_count))
        zf.writestr("_rels/.rels", root_rels_xml())
        zf.writestr("docProps/app.xml", app_xml())
        zf.writestr("docProps/core.xml", core_xml())
        zf.writestr("xl/workbook.xml", workbook_xml(sheet_names))
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml(sheets_count))
        zf.writestr("xl/styles.xml", styles_xml())

        for index, (_, headers, rows) in enumerate(SHEETS, start=1):
            zf.writestr(f"xl/worksheets/sheet{index}.xml", sheet_xml(headers, rows))


if __name__ == "__main__":
    build_workbook()
    print(OUTPUT_PATH)
