import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Product, ProductVariant } from "../types/api";
import { formatCurrency } from "../utils/format";
import "../ui/form/FormField.css";
import "../ui/product/ProductCard.css";
import "./ProductDetailPage.css";

export function ProductDetailPage() {
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [activeImage, setActiveImage] = useState("");
  const [selectedVariantSku, setSelectedVariantSku] = useState("");

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
          const defaultVariant = response.data.variants.find((variant) => variant.stock > 0) ?? response.data.variants[0];
          setSelectedVariantSku(defaultVariant?.sku ?? "");
          setQuantity(1);
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

  useEffect(() => {
    let active = true;

    if (!product) {
      setRelatedProducts([]);
      return () => {
        active = false;
      };
    }

    void api
      .listProducts({
        category: product.category || undefined,
        status: "active",
        limit: 8
      })
      .then((response) => {
        if (!active) {
          return;
        }

        const sameCategory = response.data.filter((item) => item.id !== product.id);
        if (sameCategory.length >= 4) {
          setRelatedProducts(sameCategory.slice(0, 4));
          return;
        }

        return api.listProducts({ status: "active", limit: 12 }).then((fallbackResponse) => {
          if (!active) {
            return;
          }

          const fallback = fallbackResponse.data.filter((item) => item.id !== product.id);
          const merged = [...sameCategory];
          for (const item of fallback) {
            if (merged.some((existing) => existing.id === item.id)) {
              continue;
            }
            merged.push(item);
            if (merged.length === 4) {
              break;
            }
          }
          setRelatedProducts(merged.slice(0, 4));
        });
      })
      .catch(() => {
        if (active) {
          setRelatedProducts([]);
        }
      });

    return () => {
      active = false;
    };
  }, [product]);

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

  const productImages =
    product?.image_urls.length ? product.image_urls : product?.image_url ? [product.image_url] : [];
  const normalizedCategory = (product?.category ?? "").trim().toLowerCase();
  const isFootwear = normalizedCategory.includes("footwear");
  const isApparel = normalizedCategory.includes("shop men") || normalizedCategory.includes("shop women");
  const selectedVariant =
    product?.variants.find((variant) => variant.sku === selectedVariantSku) ??
    product?.variants.find((variant) => variant.stock > 0) ??
    product?.variants[0] ??
    null;
  const activeStock = selectedVariant?.stock ?? product?.stock ?? 0;
  const activePrice = selectedVariant?.price ?? product?.price ?? 0;
  const stockToneClass =
    activeStock === 0 ? "detail-stock-line detail-stock-line-out" : "detail-stock-line detail-stock-line-in";
  const stockToneCopy =
    activeStock === 0 ? "Hết hàng" : activeStock <= 2 ? `Chỉ còn ${activeStock}` : `Còn hàng • ${activeStock} size/units`;
  const finishOptions = buildFinishOptions(product?.variants ?? []);
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
          value: activeStock > 0 ? `${activeStock} còn lại` : "Hết hàng"
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
  const reviewCards = [
    {
      quote: "The patina after three months of wear is incredible. These feel precise, quiet, and built to last.",
      author: "Elias M.",
      role: "Verified Architect"
    },
    {
      quote: "Surprisingly lightweight for such robust construction. Fits true to size after a short break-in period.",
      author: "Sarah J.",
      role: "Verified Artisan"
    },
    {
      quote: "The attention to detail on the stitching is better than bespoke options I've seen in Milan.",
      author: "Robert K.",
      role: "Verified Director"
    }
  ];
  const alphaScale = ["XS", "S", "M", "L", "XL"];
  const sizeOptions = product ? buildSizeOptions(product.variants, { isApparel, isFootwear, alphaScale }) : [];

  useEffect(() => {
    if (activeStock > 0 && quantity > activeStock) {
      setQuantity(activeStock);
    }
  }, [activeStock, quantity]);

  if (!product && !feedback) {
    return <div className="page-state">Đang tải thông tin sản phẩm...</div>;
  }

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
                  <p className="detail-price-display">{formatCurrency(activePrice)}</p>
                </div>

                <p className="detail-description-editorial">
                  {product.description || "Không có mô tả chi tiết. Bạn vẫn có thể dùng trang này để test media, add-to-cart và checkout flow."}
                </p>

                {finishOptions.length > 0 ? (
                  <div className="detail-option-panel">
                    <div className="detail-option-head">
                      <label>Finish</label>
                    </div>
                    <div className="detail-finish-row">
                      {finishOptions.map((finish) => (
                        <span
                          key={finish.name}
                          className={selectedVariant?.color === finish.name ? "detail-finish-swatch detail-finish-swatch-active" : "detail-finish-swatch"}
                          style={{ backgroundColor: finish.swatch }}
                          title={finish.name}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

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

                {sizeOptions.length > 0 ? (
                  <div className="detail-option-panel">
                    <div className="detail-option-head">
                      <label>{isFootwear ? "Standard Size" : isApparel ? "Size Còn Hàng" : "Kích cỡ"}</label>
                      {isFootwear ? <span>Size Chart</span> : selectedVariant?.sku ? <span>{selectedVariant.sku}</span> : null}
                    </div>

                    <div className={isFootwear ? "detail-size-grid detail-size-grid-footwear" : "detail-size-grid"}>
                      {sizeOptions.map((option) => {
                        const isSelected = selectedVariantSku === option.variant?.sku;
                        const classes = [
                          "detail-size-button",
                          isSelected ? "detail-size-button-active" : "",
                          option.variant?.stock === 0 || !option.variant ? "detail-size-button-unavailable" : ""
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <button
                            key={option.key}
                            className={classes}
                            disabled={!option.variant || option.variant.stock === 0}
                            type="button"
                            onClick={() => setSelectedVariantSku(option.variant?.sku ?? "")}
                          >
                            <strong>{option.label}</strong>
                            {!isFootwear ? (
                              <small className={option.variant && option.variant.stock > 0 ? "detail-size-note" : "detail-size-note detail-size-note-out"}>
                                {option.variant && option.variant.stock > 0 ? `Còn ${option.variant.stock}` : "Hết Hàng"}
                              </small>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="detail-action-panel">
                  <p className={stockToneClass}>{stockToneCopy}</p>

                  <label className="field detail-quantity-field" htmlFor="detail-quantity">
                    <span className="field-label">Số lượng</span>
                    <input
                      id="detail-quantity"
                      max={activeStock || undefined}
                      min="1"
                      step="1"
                      type="number"
                      value={quantity}
                      onChange={(event) => {
                        const nextValue = Number.parseInt(event.target.value, 10) || 1;
                        setQuantity(activeStock > 0 ? Math.min(Math.max(nextValue, 1), activeStock) : 1);
                      }}
                    />
                  </label>

                  <div className="product-actions detail-actions-editorial">
                    <button
                      className="primary-button"
                      disabled={isBusy || activeStock === 0}
                      onClick={() => void handleAddToCart()}
                      type="button"
                    >
                      {isBusy ? "Đang thêm..." : "Add to Cart"}
                    </button>
                    <button
                      className="secondary-button"
                      disabled={activeStock === 0}
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

            <section className="detail-platform-section">
              <div className="detail-platform-head">
                <span className="section-kicker">Backend Integrity</span>
                <h2>System Architecture</h2>
              </div>

              <div className="detail-platform-flow">
                {systemCards.map((item, index) => (
                  <div className="detail-platform-flow-item" key={item.title}>
                    <article className={index === 1 ? "detail-system-card detail-system-card-active" : "detail-system-card"}>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </article>
                    {index < systemCards.length - 1 ? <span className="detail-platform-arrow" aria-hidden="true">→</span> : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="detail-review-section">
              <div className="detail-review-head">
                <div>
                  <h2>The Wearer's Voice</h2>
                  <p className="detail-review-summary">★★★★★ 4.8 based on 128 reviews</p>
                </div>
                <button className="detail-review-link" type="button">
                  Write a Review
                </button>
              </div>

              <div className="detail-review-grid">
                {reviewCards.map((review) => (
                  <article className="detail-review-card" key={review.author}>
                    <span className="detail-review-stars">★★★★★</span>
                    <p>{review.quote}</p>
                    <div className="detail-review-author">
                      <strong>{review.author}</strong>
                      <span>{review.role}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="detail-look-section">
              <div className="detail-look-head">
                <h2>Complete The Look</h2>
              </div>

              <div className="detail-look-grid">
                {relatedProducts.map((item) => (
                  <Link className="detail-look-card" key={item.id} to={`/products/${item.id}`}>
                    <div className="detail-look-media">
                      {item.image_urls[0] ?? item.image_url ? (
                        <img alt={item.name} src={item.image_urls[0] ?? item.image_url} />
                      ) : (
                        <div className="mock-image">{item.name.slice(0, 1).toUpperCase()}</div>
                      )}
                    </div>
                    <div className="detail-look-copy">
                      <strong>{item.name}</strong>
                      <span>{formatCurrency(item.price)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </div>
  );
}

function buildSizeOptions(
  variants: ProductVariant[],
  options: {
    isApparel: boolean;
    isFootwear: boolean;
    alphaScale: string[];
  }
) {
  const variantsBySize = new Map(
    variants.map((variant) => [normalizeSizeLabel(variant.size || variant.label), variant] as const)
  );
  const hasAlphaSizes = variants.some((variant) => /^[A-Za-z]+$/.test(normalizeSizeLabel(variant.size || variant.label)));
  const baseSizes = options.isApparel && hasAlphaSizes
    ? options.alphaScale
    : Array.from(new Set(variants.map((variant) => normalizeSizeLabel(variant.size || variant.label))));

  return baseSizes.map((size) => ({
    key: size,
    label: options.isFootwear ? size.padStart(2, "0") : size,
    variant: variantsBySize.get(size) ?? null
  }));
}

function normalizeSizeLabel(value?: string) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^EU\s+/i, "");
}

function buildFinishOptions(variants: ProductVariant[]) {
  const swatchMap: Record<string, string> = {
    black: "#1b1c19",
    espresso: "#4a3728",
    brown: "#7d5c41",
    tan: "#a6774f",
    stone: "#d8d5ce",
    cream: "#f0e5d2",
    oat: "#dcc8aa",
    sand: "#cfb090",
    forest: "#1f3b2d",
    olive: "#5d6840",
    charcoal: "#434843",
    slate: "#5b617d",
    oak: "#8c6a44"
  };

  return Array.from(
    new Set(variants.map((variant) => (variant.color ?? "").trim().toLowerCase()).filter(Boolean))
  ).map((name) => ({
    name,
    swatch: swatchMap[name] ?? "#737973"
  }));
}
