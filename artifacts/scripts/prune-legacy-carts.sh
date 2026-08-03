#!/usr/bin/env bash
#
# Dọn các dòng giỏ hàng còn sót lại từ trước khi variant đi xuyên suốt.
#
# BỐI CẢNH: giỏ hàng lưu ở Redis dạng blob JSON tại key `cart:{userID}`. Trước
# migration variant, dòng giỏ chỉ mang `product_id`. Với sản phẩm có khai báo
# `variants`, dòng như vậy giờ không hợp lệ: checkout không biết trừ kho size
# nào nên sẽ trả 400 "variant required" — khách gặp lỗi ở đúng bước thanh toán,
# nơi khó chịu nhất.
#
# CÁCH LÀM: chỉ xoá đúng những dòng đã hỏng thay vì flush sạch mọi giỏ hàng.
# Dòng của sản phẩm không có variant vẫn hợp lệ và được giữ nguyên, nên khách
# không mất giỏ hàng một cách vô cớ. Giỏ nào rỗng sau khi lọc thì xoá hẳn key.
#
# Script chạy được nhiều lần: lần chạy thứ hai không còn gì để dọn.
#
# Cách dùng:
#   ./artifacts/scripts/prune-legacy-carts.sh            # xem trước, không ghi
#   ./artifacts/scripts/prune-legacy-carts.sh --apply    # thực sự ghi

set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-ecommerce-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-ecommerce-redis}"
POSTGRES_USER="${POSTGRES_USER:-admin}"
PRODUCT_DB="${PRODUCT_DB:-ecommerce_product}"

APPLY="false"
if [[ "${1:-}" == "--apply" ]]; then
  APPLY="true"
fi

for container in "$POSTGRES_CONTAINER" "$REDIS_CONTAINER"; do
  if ! docker ps --format '{{.Names}}' | grep -qx "$container"; then
    echo "Không thấy container '$container' đang chạy. Bật stack trước đã." >&2
    exit 1
  fi
done

# Sản phẩm nào có variant thì dòng giỏ hàng của nó bắt buộc phải có sku.
variant_products="$(
  docker exec -i "$POSTGRES_CONTAINER" \
    psql -U "$POSTGRES_USER" -d "$PRODUCT_DB" -At \
    -c "SELECT id FROM products WHERE jsonb_array_length(variants) > 0"
)"

cart_keys="$(docker exec "$REDIS_CONTAINER" redis-cli --scan --pattern 'cart:*' </dev/null || true)"

if [[ -z "${cart_keys//[[:space:]]/}" ]]; then
  echo "Không có giỏ hàng nào trong Redis. Không phải dọn gì."
  exit 0
fi

# Đọc từng cart ra, lọc bằng python rồi ghi lại. Dùng python vì payload là JSON
# và tổng tiền phải tính lại cho khớp với các dòng còn giữ.
#
# Mọi `docker exec` trong thân vòng lặp đều bỏ cờ -i và đóng stdin bằng
# `</dev/null`. Không làm vậy thì lệnh đầu tiên nuốt luôn phần stdin còn lại của
# `while read` và script chỉ xử lý đúng một key rồi im lặng bỏ qua phần còn lại —
# im lặng ở đây nguy hiểm vì trông y hệt như "không có gì để dọn".
while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  payload="$(docker exec "$REDIS_CONTAINER" redis-cli GET "$key" </dev/null 2>/dev/null || true)"
  [[ -z "$payload" ]] && continue

  result="$(
    VARIANT_PRODUCTS="$variant_products" CART_KEY="$key" CART_PAYLOAD="$payload" python3 <<'PY'
import json
import os

variant_products = {line.strip() for line in os.environ["VARIANT_PRODUCTS"].splitlines() if line.strip()}
key = os.environ["CART_KEY"]

try:
    cart = json.loads(os.environ["CART_PAYLOAD"])
except json.JSONDecodeError:
    print(json.dumps({"action": "skip", "reason": "payload không phải JSON hợp lệ"}))
    raise SystemExit(0)

items = cart.get("items") or []
kept = [
    item
    for item in items
    if item.get("sku") or item.get("product_id") not in variant_products
]
dropped = len(items) - len(kept)

if dropped == 0:
    print(json.dumps({"action": "keep", "dropped": 0}))
    raise SystemExit(0)

if not kept:
    print(json.dumps({"action": "delete", "dropped": dropped}))
    raise SystemExit(0)

cart["items"] = kept
cart["total"] = round(sum(i.get("price", 0) * i.get("quantity", 0) for i in kept), 2)
print(json.dumps({"action": "rewrite", "dropped": dropped, "payload": json.dumps(cart, ensure_ascii=False)}))
PY
  )"

  action="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["action"])' <<<"$result")"
  dropped="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(d.get("dropped", 0))' <<<"$result")"

  case "$action" in
    keep) ;;
    skip)
      echo "BỎ QUA  $key — payload không đọc được"
      ;;
    delete)
      echo "XOÁ     $key — cả $dropped dòng đều thiếu sku"
      if [[ "$APPLY" == "true" ]]; then
        docker exec "$REDIS_CONTAINER" redis-cli DEL "$key" </dev/null >/dev/null
      fi
      ;;
    rewrite)
      echo "GỌN     $key — bỏ $dropped dòng thiếu sku, giữ phần còn lại"
      if [[ "$APPLY" == "true" ]]; then
        new_payload="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["payload"])' <<<"$result")"
        # TTL của giỏ hàng do cart-service quản lý; giữ nguyên hạn cũ bằng KEEPTTL.
        docker exec "$REDIS_CONTAINER" redis-cli SET "$key" "$new_payload" KEEPTTL </dev/null >/dev/null
      fi
      ;;
  esac
done <<<"$cart_keys"

if [[ "$APPLY" == "true" ]]; then
  echo "Đã dọn xong."
else
  echo "Đây mới là xem trước. Chạy lại với --apply để thực sự ghi."
fi
