import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PriceLabel } from "../../components/price-label";
import { ProductImage } from "../../components/product-image";
import { listProductsByIDs } from "../../services/product-service";
import { useAuth } from "../../state/auth-context";
import { useWishlist } from "../../state/wishlist-context";
import type { Product, WishlistAlert } from "../../types/api";
import { formatDate, getProductImage } from "../../utils/format";
import { alertLabel } from "./account-helpers";

/**
 * Wishlist + dải alert (giảm giá / có hàng lại). Item wishlist chỉ có
 * product_id nên tên/ảnh/giá phải nạp thêm từ product API theo batch.
 */
export function WishlistSection({ alerts }: { alerts: WishlistAlert[] }) {
  const { token } = useAuth();
  const { items: wishlistItems, error: wishlistError, removeItem: removeWishlistItem } = useWishlist();
  const [wishlistProducts, setWishlistProducts] = useState<Record<string, Product>>({});

  const safeWishlistItems = useMemo(
    () => (Array.isArray(wishlistItems) ? wishlistItems : []),
    [wishlistItems],
  );

  useEffect(() => {
    let active = true;

    async function loadWishlistProducts() {
      if (!token || safeWishlistItems.length === 0) {
        setWishlistProducts({});
        return;
      }

      const productIds = safeWishlistItems.map((item) => item.product_id);
      const products = await listProductsByIDs(productIds).catch(() => []);

      if (active) {
        setWishlistProducts(
          Object.fromEntries(products.map((product) => [product.id, product] as const)),
        );
      }
    }

    void loadWishlistProducts();

    return () => {
      active = false;
    };
  }, [token, safeWishlistItems]);

  return (
    <section className="surface-section" id="wishlist">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Wishlist</span>
          <h2>Sản phẩm yêu thích</h2>
        </div>
        <Link to="/products">Xem sản phẩm</Link>
      </div>
      {wishlistError ? <p className="inline-error">{wishlistError}</p> : null}
      {alerts.length > 0 ? (
        <div className="alert-strip">
          {alerts.map((alert) => (
            <article key={`${alert.product_id}-${alert.kind}`} className="alert-card">
              <strong>{alertLabel(alert)}</strong>
              <span>{alert.product_name || alert.product_id}</span>
              {alert.kind === "price_drop" && alert.current_price ? (
                <PriceLabel value={alert.current_price} />
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
      {safeWishlistItems.length === 0 ? (
        <p>Chưa có sản phẩm yêu thích.</p>
      ) : (
        <div className="wishlist-list">
          {safeWishlistItems.map((item) => {
            const product = wishlistProducts[item.product_id];
            return (
              <article key={item.product_id} className="wishlist-card">
                <Link to={`/products/${item.product_id}`} className="wishlist-card__media">
                  <ProductImage
                    src={product ? getProductImage(product) : ""}
                    alt={product?.name ?? item.product_id}
                  />
                </Link>
                <div>
                  <Link to={`/products/${item.product_id}`}>
                    <strong>{product?.name ?? item.product_id}</strong>
                  </Link>
                  <p>{formatDate(item.updated_at)}</p>
                </div>
                {typeof product?.price === "number" ? (
                  <PriceLabel value={product.price} />
                ) : item.baseline_price ? (
                  <PriceLabel value={item.baseline_price} />
                ) : (
                  <span>Đã lưu</span>
                )}
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => void removeWishlistItem(item.product_id)}
                >
                  Xóa
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
