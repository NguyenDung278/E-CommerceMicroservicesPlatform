import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCart } from "@/features/cart/hooks/use-cart";
import { useWishlist } from "@/features/wishlist";
import { api, getErrorMessage } from "@/services/api";
import type { Product } from "@/types/api";
import { formatCompactCount, formatCurrency } from "@/utils/format";
import "@/styles/pages/storefront/wishlist-page.css";

export function WishlistPage() {
  useAuth();
  const { addItem } = useCart();
  const { wishlist, wishlistCount, toggleWishlist, clearWishlist, isLoading, error } =
    useWishlist();
  const [productsById, setProductsById] = useState<Record<string, Product>>({});
  const [feedback, setFeedback] = useState("");
  const [busyProductId, setBusyProductId] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [bulkAction, setBulkAction] = useState<"" | "bag" | "clear">("");

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
    () =>
      wishlist
        .map((productId) => productsById[productId])
        .filter((product): product is Product => Boolean(product)),
    [productsById, wishlist]
  );
  const availableProducts = useMemo(
    () => savedProducts.filter((product) => getWishlistAvailableStock(product) > 0),
    [savedProducts]
  );
  const wishlistSummary = useMemo(() => buildWishlistSummary(savedProducts), [savedProducts]);

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

  async function handleAddAvailableToCart() {
    if (availableProducts.length === 0) {
      setFeedback("Chưa có món nào sẵn sàng để thêm vào giỏ hàng.");
      return;
    }

    try {
      setBulkAction("bag");
      const results = await Promise.allSettled(
        availableProducts.map((product) =>
          addItem({
            product_id: product.id,
            quantity: 1,
          })
        )
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = availableProducts.length - successCount;

      if (successCount === 0) {
        setFeedback("Chưa thể thêm các món đã lưu vào giỏ hàng ngay lúc này.");
        return;
      }

      setFeedback(
        failedCount === 0
          ? `Đã thêm ${successCount} món sẵn sàng giao ngay vào giỏ hàng.`
          : `Đã thêm ${successCount} món vào giỏ hàng. ${failedCount} món còn lại cần kiểm tra lại tồn kho.`
      );
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBulkAction("");
    }
  }

  async function handleClearSavedPieces() {
    try {
      setBulkAction("clear");
      await clearWishlist();
      setFeedback("Wishlist đã được làm trống.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBulkAction("");
    }
  }

  return (
    <div className="page-stack wishlist-page">
      <section className="content-section wishlist-shell">
        <div className="wishlist-heading">
          <div className="wishlist-heading-copy">
            <span className="section-kicker">Wishlist</span>
            <h1>Saved for later</h1>
          </div>
          <div className="wishlist-heading-side">
            <div className="wishlist-heading-meta">
              <strong>{formatCompactCount(wishlistCount)}</strong>
              <span>{wishlistCount === 1 ? "saved piece" : "saved pieces"}</span>
            </div>

            <div className="wishlist-heading-actions">
              <Link className="secondary-button" to="/products">
                Continue browsing
              </Link>
              <button
                className="primary-button"
                disabled={bulkAction !== "" || availableProducts.length === 0}
                type="button"
                onClick={() => void handleAddAvailableToCart()}
              >
                {bulkAction === "bag" ? "Adding pieces..." : "Add ready pieces to bag"}
              </button>
              {savedProducts.length > 0 ? (
                <button
                  className="wishlist-toolbar-link"
                  disabled={bulkAction !== ""}
                  type="button"
                  onClick={() => void handleClearSavedPieces()}
                >
                  {bulkAction === "clear" ? "Clearing..." : "Clear saved pieces"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {savedProducts.length > 0 ? (
          <div className="wishlist-insight-grid">
            <article className="wishlist-insight-card">
              <span>Ready to bag</span>
              <strong>{formatCompactCount(wishlistSummary.readyToBagCount)}</strong>
            </article>
            <article className="wishlist-insight-card">
              <span>Collections</span>
              <strong>{formatCompactCount(wishlistSummary.categoryCount)}</strong>
            </article>
            <article className="wishlist-insight-card">
              <span>Variant-rich</span>
              <strong>{formatCompactCount(wishlistSummary.variantReadyCount)}</strong>
            </article>
            <article className="wishlist-insight-card">
              <span>Saved value</span>
              <strong>{formatCurrency(wishlistSummary.totalValue)}</strong>
            </article>
          </div>
        ) : null}

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}
        {error ? <div className="feedback feedback-info">{error}</div> : null}

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
                      <div className="wishlist-card-copy-kicker">
                        <span>{product.brand || product.category || "ND Shop"}</span>
                        <span
                          className={
                            getWishlistAvailableStock(product) > 0
                              ? "wishlist-stock-pill"
                              : "wishlist-stock-pill wishlist-stock-pill-out"
                          }
                        >
                          {buildWishlistAvailabilityLabel(product)}
                        </span>
                      </div>
                      <h2>{product.name}</h2>
                    </div>
                    <strong>{formatCurrency(product.price)}</strong>
                  </div>

                  <div className="wishlist-card-meta-row">
                    <span className="wishlist-meta-chip">
                      {product.category || "General archive"}
                    </span>
                    <span className="wishlist-meta-chip">
                      {product.variants.length > 0
                        ? `${product.variants.length} selectable options`
                        : "Single configuration"}
                    </span>
                    {product.tags[0] ? (
                      <span className="wishlist-meta-chip">#{product.tags[0]}</span>
                    ) : null}
                  </div>
                  <div className="wishlist-card-actions">
                    <Link className="secondary-button" to={`/products/${encodeURIComponent(product.id)}`}>
                      View details
                    </Link>
                    <button
                      className="primary-button"
                      disabled={
                        bulkAction === "bag" ||
                        bulkAction === "clear" ||
                        busyProductId === product.id ||
                        getWishlistAvailableStock(product) <= 0
                      }
                      type="button"
                      onClick={() => void handleAddToCart(product)}
                    >
                      {busyProductId === product.id
                        ? "Đang thêm..."
                        : getWishlistAvailableStock(product) > 0
                          ? "Add to cart"
                          : "Out of stock"}
                    </button>
                    <button
                      className="wishlist-remove-button"
                      disabled={bulkAction !== ""}
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

function getWishlistAvailableStock(product: Product) {
  const variantStock = product.variants.reduce((sum, variant) => sum + Math.max(variant.stock, 0), 0);
  return variantStock > 0 ? variantStock : Math.max(product.stock, 0);
}

function buildWishlistAvailabilityLabel(product: Product) {
  const availableStock = getWishlistAvailableStock(product);
  if (availableStock <= 0) {
    return "Waitlist";
  }
  if (availableStock <= 2) {
    return `Only ${availableStock} left`;
  }
  return "Ready now";
}

function buildWishlistSummary(products: Product[]) {
  const categoryCount = new Set(
    products.map((product) => product.category.trim()).filter(Boolean)
  ).size;

  return {
    totalValue: products.reduce((sum, product) => sum + product.price, 0),
    readyToBagCount: products.filter((product) => getWishlistAvailableStock(product) > 0).length,
    categoryCount,
    variantReadyCount: products.filter((product) => product.variants.length > 0).length,
  };
}
