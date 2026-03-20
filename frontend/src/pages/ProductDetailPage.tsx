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

  useEffect(() => {
    let active = true;

    void api
      .getProductById(productId)
      .then((response) => {
        if (active) {
          setProduct(response.data);
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

  return (
    <div className="page-stack">
      <section className="content-section">
        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        {product ? (
          <div className="detail-layout">
            <div className="detail-media">
              <div className="mock-image">{product.name.slice(0, 1).toUpperCase()}</div>
            </div>

            <div className="detail-copy">
              <span className="section-kicker">{product.category || "general"}</span>
              <h1>{product.name}</h1>
              <p>{product.description || "Không có mô tả chi tiết."}</p>
              <div className="detail-meta">
                <strong>${product.price.toFixed(2)}</strong>
                <span>Tồn kho: {product.stock}</span>
              </div>

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
