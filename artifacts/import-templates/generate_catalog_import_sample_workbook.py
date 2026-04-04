#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


OUTPUT_PATH = Path(__file__).resolve().parent / "catalog-import-sample-workbook.xlsx"

SHEETS = [
    (
        "categories",
        [
            "slug",
            "display_name",
            "nav_label",
            "status",
            "hero",
            "filter_config",
            "seo",
            "created_at",
            "updated_at",
        ],
        [
            [
                "shop-men",
                "Shop Men",
                "Men",
                "active",
                '{"variant":"dark-immersive","title":"Men\'s Atelier","imageUrl":"https://example.com/editorial/shop-men-hero.jpg"}',
                '[{"key":"size","kind":"sizes"},{"key":"material","kind":"list"},{"key":"price","kind":"price"}]',
                '{"title":"Men\'s Collection","description":"Shop the latest men\'s apparel"}',
                "2025-09-26 10:00:00",
                "2025-09-26 10:00:00",
            ],
            [
                "atelier-women",
                "Atelier Women",
                "Women",
                "active",
                '{"variant":"light-editorial","title":"Women\'s Atelier","imageUrl":"https://example.com/editorial/atelier-women-hero.jpg"}',
                '[{"key":"size","kind":"sizes"},{"key":"color","kind":"palette"}]',
                '{"title":"Women\'s Atelier","description":"Discover refined silhouettes and seasonal edits"}',
                "2025-09-26 10:05:00",
                "2025-09-26 10:05:00",
            ],
        ],
    ),
    (
        "category_aliases",
        ["category_slug", "alias"],
        [
            ["shop-men", "Shop Men"],
            ["shop-men", "men"],
            ["shop-men", "mens"],
            ["atelier-women", "Atelier Women"],
            ["atelier-women", "women-atelier"],
        ],
    ),
    (
        "products",
        [
            "id",
            "external_id",
            "name",
            "category_slug",
            "category",
            "price",
            "stock",
            "material",
            "merchandising_rank",
            "updated_at",
        ],
        [
            [
                "550e8400-e29b-41d4-a716-446655440000",
                "SM-001",
                "Linen Shirt",
                "shop-men",
                "shop-men",
                129.99,
                18,
                "Italian Linen",
                1,
                "2025-09-26 10:00:00",
            ],
            [
                "550e8400-e29b-41d4-a716-446655440001",
                "SM-002",
                "Cotton Tee",
                "shop-men",
                "shop-men",
                49.99,
                42,
                "Organic Cotton",
                2,
                "2025-09-26 10:00:00",
            ],
            [
                "550e8400-e29b-41d4-a716-446655440002",
                "AW-001",
                "Silk Dress",
                "atelier-women",
                "atelier-women",
                229.00,
                7,
                "Mulberry Silk",
                1,
                "2025-09-26 10:05:00",
            ],
        ],
    ),
    (
        "variants",
        ["id", "product_external_id", "sku", "size", "color", "stock", "price", "image_url"],
        [
            [
                "660e8400-e29b-41d4-a716-446655440000",
                "SM-001",
                "SM-001-M",
                "M",
                "White",
                10,
                129.99,
                "https://example.com/images/sm001-m.jpg",
            ],
            [
                "660e8400-e29b-41d4-a716-446655440001",
                "SM-001",
                "SM-001-L",
                "L",
                "White",
                8,
                129.99,
                "https://example.com/images/sm001-l.jpg",
            ],
            [
                "660e8400-e29b-41d4-a716-446655440002",
                "SM-002",
                "SM-002-S",
                "S",
                "Navy",
                42,
                49.99,
                "https://example.com/images/sm002-s.jpg",
            ],
        ],
    ),
    (
        "editorial_sections",
        ["id", "category_slug", "section_type", "position", "payload", "published"],
        [
            [
                "770e8400-e29b-41d4-a716-446655440000",
                "shop-men",
                "hero-banner",
                1,
                '{"variant":"dark-immersive","title":"Spring Drop","subtitle":"New arrivals"}',
                True,
            ],
            [
                "770e8400-e29b-41d4-a716-446655440001",
                "shop-men",
                "product-grid",
                2,
                '{"columns":3,"productIds":["SM-001","SM-002"]}',
                True,
            ],
            [
                "770e8400-e29b-41d4-a716-446655440002",
                "atelier-women",
                "story-block",
                1,
                '{"heading":"Craftsmanship","body":"Hand-stitched details"}',
                True,
            ],
        ],
    ),
    (
        "featured_products",
        ["id", "product_external_id", "category_slug", "position"],
        [
            ["880e8400-e29b-41d4-a716-446655440000", "SM-001", "shop-men", 1],
            ["880e8400-e29b-41d4-a716-446655440001", "AW-001", "atelier-women", 1],
        ],
    ),
]


def excel_column_name(index: int) -> str:
    result = []
    current = index
    while current > 0:
        current, remainder = divmod(current - 1, 26)
        result.append(chr(65 + remainder))
    return "".join(reversed(result))


def cell_xml(ref: str, value) -> str:
    if isinstance(value, bool):
        return f'<c r="{ref}" t="b"><v>{"1" if value else "0"}</v></c>'
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{ref}"><v>{value}</v></c>'
    if value is None:
        return f'<c r="{ref}" t="inlineStr"><is><t></t></is></c>'

    text = escape(str(value))
    return f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>'


def sheet_xml(headers: list[str], rows: list[list[object]]) -> str:
    all_rows = [headers] + rows
    row_xml = []
    for row_index, row in enumerate(all_rows, start=1):
        cells = []
        for col_index, value in enumerate(row, start=1):
            ref = f"{excel_column_name(col_index)}{row_index}"
            cells.append(cell_xml(ref, value))
        row_xml.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    last_ref = f"{excel_column_name(len(headers))}{len(all_rows)}"
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f"<dimension ref=\"A1:{last_ref}\"/>"
        "<sheetViews><sheetView workbookViewId=\"0\"/></sheetViews>"
        "<sheetFormatPr defaultRowHeight=\"15\"/>"
        "<sheetData>"
        + "".join(row_xml)
        + "</sheetData>"
        "</worksheet>"
    )


def workbook_xml() -> str:
    sheet_tags = []
    for index, (name, _, _) in enumerate(SHEETS, start=1):
        escaped_name = escape(name)
        sheet_tags.append(
            f'<sheet name="{escaped_name}" sheetId="{index}" r:id="rId{index}"/>'
        )

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        "<bookViews><workbookView/></bookViews>"
        f"<sheets>{''.join(sheet_tags)}</sheets>"
        "</workbook>"
    )


def workbook_rels_xml() -> str:
    relationships = []
    for index in range(1, len(SHEETS) + 1):
        relationships.append(
            f'<Relationship Id="rId{index}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            f'Target="worksheets/sheet{index}.xml"/>'
        )

    style_rel_id = len(SHEETS) + 1
    relationships.append(
        f'<Relationship Id="rId{style_rel_id}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
        'Target="styles.xml"/>'
    )

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f"{''.join(relationships)}"
        "</Relationships>"
    )


def root_rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" '
        'Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" '
        'Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" '
        'Target="docProps/app.xml"/>'
        "</Relationships>"
    )


def content_types_xml() -> str:
    overrides = [
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        '<Override PartName="/docProps/core.xml" '
        'ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    ]

    for index in range(1, len(SHEETS) + 1):
        overrides.append(
            f'<Override PartName="/xl/worksheets/sheet{index}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        f"{''.join(overrides)}"
        "</Types>"
    )


def styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>'
        '<fills count="2"><fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        "</styleSheet>"
    )


def app_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        "<Application>Codex</Application>"
        "</Properties>"
    )


def core_xml() -> str:
    created = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        "<dc:title>Catalog Import Sample Workbook</dc:title>"
        "<dc:creator>Codex</dc:creator>"
        "<cp:lastModifiedBy>Codex</cp:lastModifiedBy>"
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>'
        "</cp:coreProperties>"
    )


def build_workbook() -> None:
    with ZipFile(OUTPUT_PATH, "w", compression=ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types_xml())
        zf.writestr("_rels/.rels", root_rels_xml())
        zf.writestr("docProps/app.xml", app_xml())
        zf.writestr("docProps/core.xml", core_xml())
        zf.writestr("xl/workbook.xml", workbook_xml())
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml())
        zf.writestr("xl/styles.xml", styles_xml())

        for index, (_, headers, rows) in enumerate(SHEETS, start=1):
            zf.writestr(f"xl/worksheets/sheet{index}.xml", sheet_xml(headers, rows))


if __name__ == "__main__":
    build_workbook()
    print(OUTPUT_PATH)
