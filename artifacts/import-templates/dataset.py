import csv
from pathlib import Path


def parse_csv_value(val: str, col_name: str) -> object:
    if not val:
        return None
    val_lower = val.lower()
    if val_lower == 'true':
        return True
    if val_lower == 'false':
        return False
        
    # Certain IDs or codes should remain strings even if they are numeric
    string_cols = {
        'id', 'external_id', 'sku', 'product_external_id', 
        'category_slug', 'slug', 'category', 'alias'
    }
    if col_name in string_cols:
        return val
        
    try:
        if '.' in val:
            return float(val)
        return int(val)
    except ValueError:
        return val


def load_data() -> list[tuple[str, list[str], list[list[object]]]]:
    csv_dir = Path(__file__).resolve().parent / "csv_data"
    
    sheet_order = [
        "categories",
        "category_aliases",
        "products",
        "variants",
        "editorial_sections",
        "featured_products"
    ]
    
    sheets = []
    if not csv_dir.exists():
        # Fallback empty sheets or handle as needed
        return sheets

    for sheet_name in sheet_order:
        csv_file = csv_dir / f"{sheet_name}.csv"
        if not csv_file.exists():
            continue
            
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader, [])
            rows = []
            for string_row in reader:
                # Align string row values with headers for parsing
                parsed_row = [
                    parse_csv_value(val, hd) if i < len(headers) else val
                    for i, (val, hd) in enumerate(zip(string_row, headers))
                ]
                rows.append(parsed_row)
            sheets.append((sheet_name, headers, rows))
            
    return sheets


SHEETS = load_data()
