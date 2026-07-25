#!/usr/bin/env bash
# Chạy trọn gói bài chứng minh không oversell:
#   1. seed một sản phẩm stock nhỏ thẳng vào ecommerce_product
#   2. bắn k6 concurrent checkout qua gateway
#   3. verify DB: stock về 0, số đơn pending đúng bằng stock, ledger khớp
#
# Yêu cầu: stack đang chạy (make compose-up), k6 đã cài.
# Env override: STOCK, VUS, ITERATIONS, BASE_URL, PGUSER, PGCONTAINER.
set -euo pipefail

STOCK="${STOCK:-10}"
VUS="${VUS:-50}"
ITERATIONS="${ITERATIONS:-200}"
BASE_URL="${BASE_URL:-http://localhost:8080}"
PGUSER="${PGUSER:-admin}"
PGCONTAINER="${PGCONTAINER:-ecommerce-postgres}"

PRODUCT_ID="oversell-$(date +%s)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

psql_product() {
  docker exec "$PGCONTAINER" psql -U "$PGUSER" -d ecommerce_product -tA -c "$1"
}

psql_order() {
  docker exec "$PGCONTAINER" psql -U "$PGUSER" -d ecommerce_order -tA -c "$1"
}

echo "==> Seed sản phẩm $PRODUCT_ID với stock=$STOCK"
psql_product "INSERT INTO products (
    id, name, description, price, stock, category, brand, tags, status, sku,
    variants, image_url, image_urls, created_at, updated_at
) VALUES (
    '$PRODUCT_ID', 'Oversell Test Product', 'seeded by tests/load/run_oversell.sh',
    10, $STOCK, 'LoadTest', 'k6', '[]'::jsonb, 'active', 'SKU-$PRODUCT_ID',
    '[]'::jsonb, '', '[]'::jsonb, NOW(), NOW()
);" > /dev/null

echo "==> Bắn k6: $VUS VU, $ITERATIONS lần checkout vào stock $STOCK"
k6 run \
  -e BASE_URL="$BASE_URL" \
  -e PRODUCT_ID="$PRODUCT_ID" \
  -e STOCK="$STOCK" \
  -e VUS="$VUS" \
  -e ITERATIONS="$ITERATIONS" \
  "$SCRIPT_DIR/oversell.js"
K6_EXIT=$?

echo "==> Verify DB sau khi bắn"
FINAL_STOCK="$(psql_product "SELECT stock FROM products WHERE id='$PRODUCT_ID';")"
ACTIVE_RESERVED="$(psql_product "SELECT COALESCE(SUM(quantity), 0) FROM stock_reservations WHERE product_id='$PRODUCT_ID' AND status='active';")"
PENDING_ORDERS="$(psql_order "SELECT COUNT(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id='$PRODUCT_ID' AND o.status='pending';")"

echo "    stock còn lại      : $FINAL_STOCK (kỳ vọng 0)"
echo "    ledger đang giữ    : $ACTIVE_RESERVED (kỳ vọng $STOCK)"
echo "    đơn pending tạo ra : $PENDING_ORDERS (kỳ vọng $STOCK)"

if [[ "$FINAL_STOCK" == "0" && "$ACTIVE_RESERVED" == "$STOCK" && "$PENDING_ORDERS" == "$STOCK" && "$K6_EXIT" == "0" ]]; then
  echo "==> PASS: không oversell — đúng $STOCK đơn giành được $STOCK stock."
  exit 0
fi

echo "==> FAIL: số liệu không khớp kỳ vọng."
exit 1
