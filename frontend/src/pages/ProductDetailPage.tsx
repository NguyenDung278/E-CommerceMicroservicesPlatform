import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Product } from "../types/api";

export function ProductDetailPage() {
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [activeImage, setActiveImage] = useState("");

  useEffect(() => {
    let active = true;

    void api
      .getProductById(productId)
      .then((response) => {
        if (active) {
          setProduct(response.data);
          const images =
            response.data.image_urls.length > 0
              ? response.data.image_urls
              : response.data.image_url
                ? [response.data.image_url]
                : [];
          setActiveImage(images[0] ?? "");
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      });

    return () => {
      active = false;
    };
  }, [productId]);

  async function handleAddToCart() {
    if (!product) {
      return;
    }

    try {
      setIsBusy(true);
      await addItem({
        product_id: product.id,
        quantity
      });
      setFeedback("Sản phẩm đã được thêm vào giỏ hàng.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsBusy(false);
    }
  }

  if (!product && !feedback) {
    return <div className="page-state">Đang tải thông tin sản phẩm...</div>;
  }

  const productImages =
    product?.image_urls.length ? product.image_urls : product?.image_url ? [product.image_url] : [];

  return (
    <div className="page-stack">
      <section className="content-section">
        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        {product ? (
          <div className="detail-layout">
            <div className="detail-media">
              {activeImage ? (
                <img className="detail-main-image" alt={product.name} src={activeImage} />
              ) : (
                <div className="mock-image">{product.name.slice(0, 1).toUpperCase()}</div>
              )}

              {productImages.length > 1 ? (
                <div className="detail-thumbnail-row">
                  {productImages.map((imageUrl, index) => (
                    <button
                      className={
                        imageUrl === activeImage
                          ? "detail-thumbnail-button detail-thumbnail-button-active"
                          : "detail-thumbnail-button"
                      }
                      key={imageUrl}
                      type="button"
                      onClick={() => setActiveImage(imageUrl)}
                    >
                      <img alt={`${product.name} ${index + 1}`} src={imageUrl} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="detail-copy">
              <span className="section-kicker">{product.category || "general"}</span>
              <h1>{product.name}</h1>
              <p>{product.description || "Không có mô tả chi tiết."}</p>
              <div className="detail-meta">
                <span>Brand: {product.brand || "No brand"}</span>
                <span>Status: {product.status || "active"}</span>
                <span>SKU: {product.sku || "pending"}</span>
              </div>
              {product.tags.length > 0 ? (
                <div className="product-tag-row">
                  {product.tags.map((tag) => (
                    <span className="product-tag-chip" key={tag}>
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="detail-meta">
                <strong>${product.price.toFixed(2)}</strong>
                <span>Tồn kho: {product.stock}</span>
              </div>
              {product.variants.length > 0 ? (
                <div className="detail-variant-list">
                  {product.variants.map((variant) => (
                    <div className="detail-variant-card" key={variant.sku}>
                      <strong>{variant.label}</strong>
                      <span>{variant.sku}</span>
                      <span>${variant.price.toFixed(2)}</span>
                      <span>Tồn kho: {variant.stock}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <label className="field" htmlFor="detail-quantity">
                <span className="field-label">Số lượng</span>
                <input
                  id="detail-quantity"
                  min="1"
                  step="1"
                  type="number"
                  value={quantity}
                  onChange={(event) => setQuantity(Number.parseInt(event.target.value, 10) || 1)}
                />
              </label>

              <div className="product-actions">
                <button
                  className="primary-button"
                  disabled={isBusy || product.stock === 0}
                  onClick={() => void handleAddToCart()}
                  type="button"
                >
                  {isBusy ? "Đang thêm..." : "Thêm vào giỏ"}
                </button>
                <button
                  className="secondary-button"
                  disabled={product.stock === 0}
                  onClick={() =>
                    navigate("/checkout", {
                      state: {
                        directProduct: {
                          id: product.id,
                          name: product.name,
                          price: product.price,
                          quantity
                        }
                      }
                    })
                  }
                  type="button"
                >
                  Mua ngay
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
