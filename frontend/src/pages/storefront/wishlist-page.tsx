import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCart } from "@/features/cart/hooks/use-cart";
import { useWishlist } from "@/features/wishlist";
import { api, getErrorMessage } from "@/services/api";
import type { Product } from "@/types/api";
import { formatCurrency } from "@/utils/format";
import "@/styles/pages/storefront/wishlist-page.css";

export function WishlistPage() {
  const { token } = useAuth();
  const { addItem } = useCart();
  const { wishlist, wishlistCount, toggleWishlist, isLoading } = useWishlist();
  const [productsById, setProductsById] = useState<Record<string, Product>>({});
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  useEffect(() => {
    let active = true;

    if (wishlist.length === 0) {
      setProductsById({});
      setIsLoadingProducts(false);
      return () => {
        active = false;
      };
    }

    setIsLoadingProducts(true);
    void api
      .listProductsByIds(wishlist)
      .then((response) => {
        if (!active) {
          return;
        }

        setProductsById(
          Object.fromEntries(response.data.map((product) => [product.id, product] as const))
        );
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingProducts(false);
        }
      });

    return () => {
      active = false;
    };
  }, [wishlist]);

  const savedProducts = useMemo(
    () => wishlist.map((productId) => productsById[productId]).filter(Boolean),
    [productsById, wishlist]
  );

  async function handleAddToCart(product: Product) {
    try {
      setBusyProductId(product.id);
      await addItem({
        product_id: product.id,
        quantity: 1,
      });
      setFeedback(`${product.name} đã được thêm vào giỏ hàng.`);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusyProductId("");
    }
  }

  return (
    <div className="page-stack wishlist-page">
      <section className="content-section wishlist-shell">
        <div className="wishlist-heading">
          <div>
            <span className="section-kicker">Wishlist</span>
            <h1>Saved for later</h1>
            <p>
              {token
                ? "Các món đã lưu được đồng bộ với tài khoản của bạn trên nhiều thiết bị."
                : "Các món đã lưu hiện được giữ trong trình duyệt này và sẽ được hợp nhất khi bạn đăng nhập."}
            </p>
          </div>
          <div className="wishlist-heading-meta">
            <strong>{wishlistCount}</strong>
            <span>{wishlistCount === 1 ? "saved piece" : "saved pieces"}</span>
          </div>
        </div>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        {isLoading || isLoadingProducts ? (
          <div className="page-state">Đang tải wishlist...</div>
        ) : savedProducts.length > 0 ? (
          <div className="wishlist-grid">
            {savedProducts.map((product) => (
              <article className="wishlist-card" key={product.id}>
                <Link className="wishlist-card-media" to={`/products/${encodeURIComponent(product.id)}`}>
                  {product.image_urls[0] || product.image_url ? (
                    <img alt={product.name} src={product.image_urls[0] || product.image_url} />
                  ) : (
                    <span>{product.name.slice(0, 1).toUpperCase()}</span>
                  )}
                </Link>

                <div className="wishlist-card-copy">
                  <div className="wishlist-card-copy-head">
                    <div>
                      <span>{product.brand || product.category || "ND Shop"}</span>
                      <h2>{product.name}</h2>
                    </div>
                    <strong>{formatCurrency(product.price)}</strong>
                  </div>

                  <p>
                    {product.description ||
                      "Một thiết kế đã được lưu lại để bạn quay lại so sánh, cân nhắc và đặt mua khi sẵn sàng."}
                  </p>

                  <div className="wishlist-card-actions">
                    <Link className="secondary-button" to={`/products/${encodeURIComponent(product.id)}`}>
                      View details
                    </Link>
                    <button
                      className="primary-button"
                      disabled={busyProductId === product.id || product.stock <= 0}
                      type="button"
                      onClick={() => void handleAddToCart(product)}
                    >
                      {busyProductId === product.id
                        ? "Đang thêm..."
                        : product.stock > 0
                          ? "Add to cart"
                          : "Out of stock"}
                    </button>
                    <button
                      className="wishlist-remove-button"
                      type="button"
                      onClick={() => void toggleWishlist(product.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-card wishlist-empty-state">
            <span className="section-kicker">Nothing saved yet</span>
            <h2>Wishlist của bạn đang trống.</h2>
            <p>
              Lưu lại những món bạn thích từ trang chi tiết sản phẩm để quay lại so sánh hoặc đặt
              mua sau.
            </p>
            <Link className="primary-link" to="/products">
              Explore the archive
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
