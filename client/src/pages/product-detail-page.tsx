import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PriceLabel } from "../components/price-label";
import { ProductImage } from "../components/product-image";
import { ErrorView, LoadingView } from "../components/status-view";
import { getProduct, getProductReviews } from "../services/product-service";
import { useAuth } from "../state/auth-context";
import { useCart } from "../state/cart-context";
import { useWishlist } from "../state/wishlist-context";
import type { Product, ProductReviewList, ProductVariant } from "../types/api";
import { getProductImage } from "../utils/format";

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { isWishlisted, toggleItem, updatingProductIds } = useWishlist();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReviewList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      if (!id) {
        setError("Thiếu mã sản phẩm");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const productData = await getProduct(id);
        const reviewData = await getProductReviews(id).catch(() => null);

        if (active) {
          setProduct(productData);
          setReviews(reviewData);
          // Chọn sẵn variant còn hàng đầu tiên để người mua không phải chọn khi
          // sản phẩm chỉ còn đúng một size.
          const variants = productData.variants ?? [];
          setSelectedSku(variants.find((variant) => variant.stock > 0)?.sku ?? null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được chi tiết sản phẩm");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <LoadingView label="Đang tải chi tiết sản phẩm" />;
  }

  if (error || !product) {
    return <ErrorView message={error ?? "Không tìm thấy sản phẩm"} />;
  }

  const productId = product.id;
  const variants: ProductVariant[] = product.variants ?? [];
  const hasVariants = variants.length > 0;
  const selectedVariant = hasVariants
    ? (variants.find((variant) => variant.sku === selectedSku) ?? null)
    : null;

  // Sản phẩm có variant thì giá và tồn kho phải đọc từ variant đang chọn: giá
  // và tồn kho ở mức sản phẩm chỉ là tổng hợp, không phải thứ khách mua.
  const displayPrice = selectedVariant ? selectedVariant.price : product.price;
  const availableStock = selectedVariant ? selectedVariant.stock : product.stock;
  const isInactive = product.status !== "active";
  const needsVariantChoice = hasVariants && !selectedVariant;
  const isUnavailable = isInactive || needsVariantChoice || availableStock <= 0;

  const wishlisted = isWishlisted(productId);
  const wishlistBusy = updatingProductIds.includes(productId);

  function addToCartLabel(): string {
    if (isInactive) {
      return "Tạm ngừng bán";
    }
    if (needsVariantChoice) {
      return "Chọn phân loại";
    }
    if (availableStock <= 0) {
      return "Tạm hết hàng";
    }
    return "Thêm vào giỏ";
  }

  function handleWishlistToggle() {
    if (!user) {
      navigate("/account", {
        state: { authError: "Bạn cần đăng nhập để lưu sản phẩm yêu thích" },
      });
      return;
    }

    void toggleItem(productId);
  }

  return (
    <div className="page-stack">
      <Link to="/products" className="text-link">
        Trở lại danh sách
      </Link>
      <section className="detail-layout">
        <div className="detail-gallery">
          <ProductImage src={getProductImage(product)} alt={product.name} />
        </div>
        <div className="detail-panel">
          {product.brand ? <span className="eyebrow">{product.brand}</span> : null}
          <h1>{product.name}</h1>
          <PriceLabel value={displayPrice} size="large" />
          {product.description ? <p>{product.description}</p> : null}
          {hasVariants ? (
            <div className="detail-variants">
              <span className="detail-variants__label">Phân loại</span>
              <div className="detail-variants__options">
                {variants.map((variant) => {
                  const soldOut = variant.stock <= 0;
                  const active = variant.sku === selectedSku;
                  return (
                    <button
                      key={variant.sku}
                      type="button"
                      className={`variant-chip${active ? " is-active" : ""}${soldOut ? " is-soldout" : ""}`}
                      disabled={soldOut}
                      aria-pressed={active}
                      onClick={() => setSelectedSku(variant.sku)}
                    >
                      {variant.label || variant.sku}
                      {soldOut ? <span className="variant-chip__note">Hết hàng</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="detail-facts">
            <span>Danh mục: {product.category || "Chưa phân loại"}</span>
            <span>
              {selectedVariant
                ? `Tồn kho ${selectedVariant.label || selectedVariant.sku}: ${availableStock}`
                : `Tồn kho: ${availableStock}`}
            </span>
            {reviews ? (
              <span>
                Đánh giá: {reviews.summary.average_rating.toFixed(1)} / 5 (
                {reviews.summary.review_count})
              </span>
            ) : null}
          </div>
          <div className="detail-actions">
            <button
              className="button button--primary detail-button"
              type="button"
              disabled={isUnavailable}
              onClick={() => void addItem(productId, 1, selectedVariant?.sku)}
            >
              {addToCartLabel()}
            </button>
            <button
              className={`button button--secondary detail-wishlist${wishlisted ? " is-active" : ""}`}
              type="button"
              disabled={wishlistBusy}
              onClick={handleWishlistToggle}
            >
              <Heart size={18} fill={wishlisted ? "currentColor" : "none"} />
              {wishlisted ? "Đã lưu wishlist" : "Lưu wishlist"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
