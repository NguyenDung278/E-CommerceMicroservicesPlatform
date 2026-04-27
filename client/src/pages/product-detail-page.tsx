import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PriceLabel } from "../components/price-label";
import { ProductImage } from "../components/product-image";
import { ErrorView, LoadingView } from "../components/status-view";
import { getProduct, getProductReviews } from "../services/product-service";
import { useCart } from "../state/cart-context";
import type { Product, ProductReviewList } from "../types/api";
import { getProductImage } from "../utils/format";

export function ProductDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReviewList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const isUnavailable = product.status !== "active" || product.stock <= 0;

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
          <PriceLabel value={product.price} size="large" />
          {product.description ? <p>{product.description}</p> : null}
          <div className="detail-facts">
            <span>Danh mục: {product.category || "Chưa phân loại"}</span>
            <span>Tồn kho: {product.stock}</span>
            {reviews ? (
              <span>
                Đánh giá: {reviews.summary.average_rating.toFixed(1)} / 5 (
                {reviews.summary.review_count})
              </span>
            ) : null}
          </div>
          <button
            className="button button--primary detail-button"
            type="button"
            disabled={isUnavailable}
            onClick={() => void addItem(product.id)}
          >
            {isUnavailable ? "Tạm hết hàng" : "Thêm vào giỏ"}
          </button>
        </div>
      </section>
    </div>
  );
}
