import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Product } from "../types/api";
import { formatCurrency } from "../utils/format";

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
  const detailHighlights = product
    ? [
        {
          label: "Brand",
          value: product.brand || "ND Atelier"
        },
        {
          label: "Status",
          value: product.status || "active"
        },
        {
          label: "SKU",
          value: product.sku || "pending"
        },
        {
          label: "Stock",
          value: product.stock > 0 ? `${product.stock} còn lại` : "Hết hàng"
        }
      ]
    : [];
  const systemCards = [
    {
      title: "Product API",
      description: "Metadata, media và category được nạp trực tiếp từ product service qua gateway."
    },
    {
      title: "Inventory Sync",
      description: "Tồn kho và variants phản ánh dữ liệu hiện có để test tình huống mua hàng thật."
    },
    {
      title: "Checkout Ready",
      description: "Từ trang này có thể thêm giỏ hoặc đi thẳng sang checkout với quantity hiện tại."
    }
  ];

  return (
    <div className="page-stack">
      <section className="content-section detail-editorial-shell">
        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        {product ? (
          <>
            <div className="detail-layout detail-layout-editorial">
              <div className="detail-media detail-media-editorial">
                <div className="detail-main-frame">
                  {activeImage ? (
                    <img className="detail-main-image" alt={product.name} src={activeImage} />
                  ) : (
                    <div className="mock-image">{product.name.slice(0, 1).toUpperCase()}</div>
                  )}
                </div>

                {productImages.length > 1 ? (
                  <div className="detail-thumbnail-row detail-thumbnail-row-editorial">
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

                <div className="detail-support-inline">
                  <span className="detail-support-note">Media từ backend object storage / URL được cấu hình trong product service.</span>
                </div>
              </div>

              <div className="detail-copy detail-copy-editorial">
                <div className="detail-breadcrumbs">
                  <Link className="text-link" to="/products">
                    Catalog
                  </Link>
                  {product.category ? (
                    <Link className="text-link" to={`/categories/${encodeURIComponent(product.category)}`}>
                      {product.category}
                    </Link>
                  ) : null}
                </div>

                <div className="detail-heading-block">
                  <div className="detail-badge-row">
                    <span className="section-kicker">{product.category || "atelier item"}</span>
                    {product.tags[0] ? <span className="product-tag-chip">#{product.tags[0]}</span> : null}
                  </div>
                  <h1>{product.name}</h1>
                  <p className="detail-price-display">{formatCurrency(product.price)}</p>
                </div>

                <p className="detail-description-editorial">
                  {product.description || "Không có mô tả chi tiết. Bạn vẫn có thể dùng trang này để test media, add-to-cart và checkout flow."}
                </p>

                <div className="detail-meta-grid-editorial">
                  {detailHighlights.map((item) => (
                    <article className="detail-meta-card" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </article>
                  ))}
                </div>

                {product.tags.length > 1 ? (
                  <div className="product-tag-row">
                    {product.tags.slice(1).map((tag) => (
                      <span className="product-tag-chip" key={tag}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {product.variants.length > 0 ? (
                  <div className="detail-variant-panel-editorial">
                    <div className="section-heading">
                      <div>
                        <h3>Variants / SKU</h3>
                        <p className="history-subtle">Chi tiết biến thể đang lấy trực tiếp từ dữ liệu catalog.</p>
                      </div>
                    </div>

                    <div className="detail-variant-grid-editorial">
                      {product.variants.map((variant) => (
                        <article className="detail-variant-card detail-variant-card-editorial" key={variant.sku}>
                          <strong>{variant.label}</strong>
                          <span>{variant.sku}</span>
                          <span>{variant.size || "No size"} • {variant.color || "No color"}</span>
                          <span>{formatCurrency(variant.price)}</span>
                          <span>Tồn kho: {variant.stock}</span>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="detail-action-panel">
                  <label className="field detail-quantity-field" htmlFor="detail-quantity">
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

                  <div className="product-actions detail-actions-editorial">
                    <button
                      className="primary-button"
                      disabled={isBusy || product.stock === 0}
                      onClick={() => void handleAddToCart()}
                      type="button"
                    >
                      {isBusy ? "Đang thêm..." : "Add to Cart"}
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

                  <p className="detail-support-note">
                    Complimentary test flow: bạn có thể thêm vào giỏ hoặc đi thẳng sang checkout để verify chức năng.
                  </p>
                </div>
              </div>
            </div>

            <div className="detail-system-grid">
              {systemCards.map((item) => (
                <article className="detail-system-card" key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
