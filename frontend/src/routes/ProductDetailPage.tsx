import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../features/auth/hooks/useAuth";
import { useCart } from "../features/cart/hooks/useCart";
import { api, getErrorMessage, isHttpError } from "../shared/api";
import type {
  Product,
  ProductReview,
  ProductReviewList,
  ProductReviewSummary,
  ProductVariant
} from "../shared/types/api";
import { formatCurrency } from "../shared/utils/format";
import "../shared/components/form/FormField.css";
import "../shared/components/product/ProductCard.css";
import "./ProductDetailPage.css";

type ReviewFormState = {
  rating: number;
  comment: string;
};

const emptyReviewSummary: ProductReviewSummary = {
  average_rating: 0,
  review_count: 0,
  rating_breakdown: {
    one: 0,
    two: 0,
    three: 0,
    four: 0,
    five: 0
  }
};

const emptyReviewList: ProductReviewList = {
  summary: emptyReviewSummary,
  items: []
};

const defaultReviewForm: ReviewFormState = {
  rating: 0,
  comment: ""
};

export function ProductDetailPage() {
  const { productId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [activeImage, setActiveImage] = useState("");
  const [selectedVariantSku, setSelectedVariantSku] = useState("");
  const [reviewList, setReviewList] = useState<ProductReviewList>(emptyReviewList);
  const [myReview, setMyReview] = useState<ProductReview | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(defaultReviewForm);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewBusyAction, setReviewBusyAction] = useState<"" | "submit" | "delete">("");
  const [isReviewLoading, setIsReviewLoading] = useState(true);

  useEffect(() => {
    let active = true;

    setFeedback("");
    setReviewFeedback("");
    setReviewList(emptyReviewList);
    setMyReview(null);
    setReviewForm(defaultReviewForm);
    setIsReviewLoading(true);

    const productRequest = api.getProductById(productId);
    const reviewListRequest = api.listProductReviews(productId, { page: 1, limit: 6 });
    const myReviewRequest =
      isAuthenticated && token
        ? api
            .getMyProductReview(token, productId)
            .then((response) => response.data)
            .catch((reason) => {
              if (isHttpError(reason) && reason.status === 404) {
                return null;
              }

              throw reason;
            })
        : Promise.resolve(null);

    void Promise.allSettled([productRequest, reviewListRequest, myReviewRequest]).then(
      ([productResult, reviewListResult, myReviewResult]) => {
        if (!active) {
          return;
        }

        if (productResult.status === "fulfilled") {
          const nextProduct = productResult.value.data;
          setProduct(nextProduct);

          const images =
            nextProduct.image_urls.length > 0
              ? nextProduct.image_urls
              : nextProduct.image_url
                ? [nextProduct.image_url]
                : [];
          setActiveImage(images[0] ?? "");

          const defaultVariant = nextProduct.variants.find((variant) => variant.stock > 0) ?? nextProduct.variants[0];
          setSelectedVariantSku(defaultVariant?.sku ?? "");
          setQuantity(1);
        } else {
          setProduct(null);
          setFeedback(getErrorMessage(productResult.reason));
        }

        if (reviewListResult.status === "fulfilled") {
          setReviewList(reviewListResult.value.data);
        } else {
          setReviewFeedback(getErrorMessage(reviewListResult.reason));
        }

        if (myReviewResult.status === "fulfilled") {
          setMyReview(myReviewResult.value);
          setReviewForm(
            myReviewResult.value
              ? {
                  rating: myReviewResult.value.rating,
                  comment: myReviewResult.value.comment
                }
              : defaultReviewForm
          );
        } else {
          setReviewFeedback(getErrorMessage(myReviewResult.reason));
        }

        setIsReviewLoading(false);
      }
    );

    return () => {
      active = false;
    };
  }, [isAuthenticated, productId, token]);

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

  async function refreshReviews(nextMessage = "") {
    setIsReviewLoading(true);

    try {
      const [reviewResponse, nextMyReview] = await Promise.all([
        api.listProductReviews(productId, { page: 1, limit: 6 }),
        isAuthenticated && token
          ? api
              .getMyProductReview(token, productId)
              .then((response) => response.data)
              .catch((reason) => {
                if (isHttpError(reason) && reason.status === 404) {
                  return null;
                }

                throw reason;
              })
          : Promise.resolve(null)
      ]);

      setReviewList(reviewResponse.data);
      setMyReview(nextMyReview);
      setReviewForm(
        nextMyReview
          ? {
              rating: nextMyReview.rating,
              comment: nextMyReview.comment
            }
          : defaultReviewForm
      );
      setReviewFeedback(nextMessage);
    } catch (reason) {
      setReviewFeedback(getErrorMessage(reason));
    } finally {
      setIsReviewLoading(false);
    }
  }

  function handleReviewCallToAction() {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }

    document.getElementById("detail-review-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!product) {
      return;
    }

    if (!isAuthenticated || !token) {
      navigate("/login", { state: { from: location } });
      return;
    }

    if (reviewForm.rating < 1 || reviewForm.rating > 5) {
      setReviewFeedback("Hãy chọn số sao từ 1 đến 5 trước khi gửi đánh giá.");
      return;
    }

    if (reviewForm.comment.trim().length > 2000) {
      setReviewFeedback("Nhận xét tối đa 2000 ký tự.");
      return;
    }

    try {
      setReviewBusyAction("submit");
      setReviewFeedback("");

      if (myReview) {
        await api.updateMyProductReview(token, product.id, {
          rating: reviewForm.rating,
          comment: reviewForm.comment.trim()
        });
        await refreshReviews("Đánh giá của bạn đã được cập nhật.");
      } else {
        await api.createProductReview(token, product.id, {
          rating: reviewForm.rating,
          comment: reviewForm.comment.trim()
        });
        await refreshReviews("Cảm ơn bạn đã gửi đánh giá.");
      }
    } catch (reason) {
      if (isHttpError(reason) && reason.status === 401) {
        navigate("/login", { state: { from: location } });
        return;
      }

      setReviewFeedback(getErrorMessage(reason));
    } finally {
      setReviewBusyAction("");
    }
  }

  async function handleDeleteReview() {
    if (!product || !token || !myReview) {
      return;
    }

    try {
      setReviewBusyAction("delete");
      setReviewFeedback("");
      await api.deleteMyProductReview(token, product.id);
      await refreshReviews("Đánh giá của bạn đã được xóa.");
    } catch (reason) {
      if (isHttpError(reason) && reason.status === 401) {
        navigate("/login", { state: { from: location } });
        return;
      }

      setReviewFeedback(getErrorMessage(reason));
    } finally {
      setReviewBusyAction("");
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
  const alphaScale = ["XS", "S", "M", "L", "XL"];
  const sizeOptions = product ? buildSizeOptions(product.variants, { isApparel, isFootwear, alphaScale }) : [];
  const averageRatingLabel =
    reviewList.summary.review_count > 0 ? reviewList.summary.average_rating.toFixed(1) : "0.0";
  const reviewSummaryStars = renderStars(Math.round(reviewList.summary.average_rating || 0));
  const reviewBreakdown = [
    { label: "5 sao", count: reviewList.summary.rating_breakdown.five },
    { label: "4 sao", count: reviewList.summary.rating_breakdown.four },
    { label: "3 sao", count: reviewList.summary.rating_breakdown.three },
    { label: "2 sao", count: reviewList.summary.rating_breakdown.two },
    { label: "1 sao", count: reviewList.summary.rating_breakdown.one }
  ];
  const hasExistingReview = Boolean(myReview);
  const reviewSubmitLabel =
    reviewBusyAction === "submit"
      ? hasExistingReview
        ? "Đang cập nhật..."
        : "Đang gửi..."
      : hasExistingReview
        ? "Cập nhật đánh giá"
        : "Gửi đánh giá";

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
                  <p className="detail-review-summary">
                    {reviewSummaryStars} {averageRatingLabel} dựa trên {reviewList.summary.review_count} đánh giá
                  </p>
                </div>
                <button className="detail-review-link" type="button" onClick={handleReviewCallToAction}>
                  {isAuthenticated ? "Viết / sửa đánh giá" : "Đăng nhập để đánh giá"}
                </button>
              </div>

              <div className="detail-review-shell">
                <div className="detail-review-summary-panel">
                  <div className="detail-review-average">
                    <strong>{averageRatingLabel}</strong>
                    <span>{reviewSummaryStars}</span>
                    <p>{reviewList.summary.review_count} đánh giá công khai cho sản phẩm này.</p>
                  </div>

                  <div className="detail-review-breakdown">
                    {reviewBreakdown.map((row) => {
                      const width =
                        reviewList.summary.review_count > 0
                          ? `${(row.count / reviewList.summary.review_count) * 100}%`
                          : "0%";

                      return (
                        <div className="detail-review-breakdown-row" key={row.label}>
                          <span className="detail-review-breakdown-label">{row.label}</span>
                          <div className="detail-review-breakdown-track" aria-hidden="true">
                            <span className="detail-review-breakdown-fill" style={{ width }} />
                          </div>
                          <strong className="detail-review-breakdown-count">{row.count}</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="detail-review-form-panel" id="detail-review-form">
                  {isAuthenticated ? (
                    <form className="detail-review-form" onSubmit={handleReviewSubmit}>
                      <div className="detail-review-form-head">
                        <strong>{hasExistingReview ? "Đánh giá của bạn" : "Chia sẻ cảm nhận"}</strong>
                        <span>
                          {hasExistingReview
                            ? "Bạn có thể chỉnh sửa số sao hoặc nội dung nhận xét bất kỳ lúc nào."
                            : "Chọn số sao và để lại nhận xét ngắn gọn cho sản phẩm này."}
                        </span>
                      </div>

                      <div className="detail-review-star-row" role="radiogroup" aria-label="Chọn số sao">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            className={
                              rating <= reviewForm.rating
                                ? "detail-review-star-button detail-review-star-button-active"
                                : "detail-review-star-button"
                            }
                            aria-pressed={rating === reviewForm.rating}
                            onClick={() => setReviewForm((current) => ({ ...current, rating }))}
                          >
                            <span aria-hidden="true">★</span>
                            <span>{rating}</span>
                          </button>
                        ))}
                      </div>

                      <label className="field" htmlFor="detail-review-comment">
                        <span className="field-label">Nhận xét</span>
                        <textarea
                          id="detail-review-comment"
                          className="detail-review-textarea"
                          maxLength={2000}
                          placeholder="Sản phẩm có đúng kỳ vọng không? Chất liệu, kích cỡ, độ hoàn thiện ra sao?"
                          value={reviewForm.comment}
                          onChange={(event) =>
                            setReviewForm((current) => ({
                              ...current,
                              comment: event.target.value
                            }))
                          }
                        />
                      </label>

                      <div className="detail-review-form-actions">
                        <button className="primary-button" disabled={reviewBusyAction !== ""} type="submit">
                          {reviewSubmitLabel}
                        </button>
                        {hasExistingReview ? (
                          <button
                            className="ghost-button"
                            disabled={reviewBusyAction !== ""}
                            type="button"
                            onClick={() => void handleDeleteReview()}
                          >
                            {reviewBusyAction === "delete" ? "Đang xóa..." : "Xóa đánh giá"}
                          </button>
                        ) : null}
                      </div>
                    </form>
                  ) : (
                    <div className="detail-review-login-card">
                      <strong>Đăng nhập để đánh giá sản phẩm</strong>
                      <p>
                        Review chỉ dành cho người dùng đã đăng nhập. Sau khi đăng nhập, bạn sẽ được quay lại đúng trang
                        hiện tại để tiếp tục viết đánh giá.
                      </p>
                      <button className="primary-button" type="button" onClick={handleReviewCallToAction}>
                        Đi tới đăng nhập
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {reviewFeedback ? <div className="feedback feedback-info detail-review-feedback">{reviewFeedback}</div> : null}

              {isReviewLoading ? (
                <div className="page-state">Đang tải đánh giá sản phẩm...</div>
              ) : reviewList.items.length > 0 ? (
                <div className="detail-review-grid">
                  {reviewList.items.map((review) => (
                    <article className="detail-review-card" key={review.id}>
                      <div className="detail-review-card-head">
                        <span className="detail-review-stars">{renderStars(review.rating)}</span>
                        <span className="detail-review-date">{formatReviewDate(review.updated_at || review.created_at)}</span>
                      </div>
                      <p>{review.comment || "Người dùng này đã chấm sao nhưng chưa để lại nhận xét chi tiết."}</p>
                      <div className="detail-review-author">
                        <strong>{review.author_label}</strong>
                        <span>{myReview?.id === review.id ? "Đánh giá của bạn" : "Người mua đã đăng nhập"}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="detail-review-empty">
                  <strong>Chưa có đánh giá nào cho sản phẩm này.</strong>
                  <span>Hãy trở thành người đầu tiên chia sẻ cảm nhận của bạn.</span>
                </div>
              )}
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

function renderStars(rating: number) {
  const clamped = Math.max(0, Math.min(5, rating));
  return `${"★".repeat(clamped)}${"☆".repeat(5 - clamped)}`;
}

function formatReviewDate(value: string) {
  if (!value) {
    return "Vừa xong";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Vừa xong";
  }

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
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
