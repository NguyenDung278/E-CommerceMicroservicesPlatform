import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  buildWorkbookFallbackProduct,
  findHomeWorkbookProductReference,
  type HomeWorkbookProductReference,
} from "@/features/home/home-workbook";
import {
  dedupeWorkbookLiveProducts,
  deriveWorkbookCategoryCandidatesFromReference,
  selectLiveProductForWorkbookEntry,
} from "@/features/home/workbook-live-products";
import { useHomeWorkbook } from "@/features/home/use-home-workbook";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { appendAuthFlowLog } from "@/features/auth/storage/auth-flow-log-storage";
import {
  clearPendingPostLoginAction,
  readPendingProductDetailAction,
  savePendingProductDetailAction,
  type PendingProductDetailActionIntent,
} from "@/features/auth/storage/post-login-action-storage";
import { useCart } from "@/features/cart/hooks/use-cart";
import { api, getErrorMessage, isHttpError } from "@/services/api";
import type {
  Product,
  ProductReview,
  ProductReviewList,
  ProductReviewSummary,
  ProductVariant,
} from "@/types/api";
import { formatCurrency } from "@/utils/format";
import "@/components/form/form-field.css";
import "@/components/product/product-card.css";
import "@/styles/pages/storefront/product-detail-page.css";

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
    five: 0,
  },
};

const emptyReviewList: ProductReviewList = {
  summary: emptyReviewSummary,
  items: [],
};

const defaultReviewForm: ReviewFormState = {
  rating: 0,
  comment: "",
};

function buildProductActionLoginRequiredMessage(intent: PendingProductDetailActionIntent) {
  if (intent === "buy_now") {
    return "Bạn cần đăng nhập để tiếp tục mua hàng. Sau khi đăng nhập, sản phẩm sẽ được tự động thêm vào giỏ hàng và chuyển bạn tới trang giỏ hàng.";
  }

  return "Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng. Sau khi đăng nhập, sản phẩm sẽ được tự động thêm vào giỏ hàng và chuyển bạn tới trang giỏ hàng.";
}

function buildProductActionCartSuccessMessage(
  productName: string,
  intent: PendingProductDetailActionIntent
) {
  if (intent === "buy_now") {
    return `${productName} đã được thêm vào giỏ hàng. Bạn có thể tiếp tục thanh toán từ giỏ hàng.`;
  }

  return `${productName} đã được thêm vào giỏ hàng.`;
}

export function ProductDetailPage() {
  const { productId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { content } = useHomeWorkbook();
  const { token, isAuthenticated, isBootstrapping } = useAuth();
  const { addItem } = useCart();
  const resumedActionRef = useRef("");

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
  const [isWorkbookFallback, setIsWorkbookFallback] = useState(false);
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  const applyProductSnapshot = useCallback((nextProduct: Product) => {
    setProduct(nextProduct);

    const images =
      nextProduct.image_urls.length > 0
        ? nextProduct.image_urls
        : nextProduct.image_url
          ? [nextProduct.image_url]
          : [];
    setActiveImage(images[0] ?? "");

    const defaultVariant =
      nextProduct.variants.find((variant) => variant.stock > 0) ?? nextProduct.variants[0];
    setSelectedVariantSku(defaultVariant?.sku ?? "");
    setQuantity(1);
  }, []);

  useEffect(() => {
    let active = true;
    const workbookReference = content ? findHomeWorkbookProductReference(content, productId) : null;

    setFeedback("");
    setReviewFeedback("");
    setReviewList(emptyReviewList);
    setMyReview(null);
    setReviewForm(defaultReviewForm);
    setIsReviewLoading(true);
    setIsWorkbookFallback(false);

    async function loadProductPage() {
      async function hydrateLiveProduct(nextProduct: Product) {
        applyProductSnapshot(nextProduct);

        const reviewListRequest = api.listProductReviews(nextProduct.id, { page: 1, limit: 6 });
        const myReviewRequest =
          isAuthenticated && token
            ? api
                .getMyProductReview(token, nextProduct.id)
                .then((response) => response.data)
                .catch((reason) => {
                  if (isHttpError(reason) && reason.status === 404) {
                    return null;
                  }

                  throw reason;
                })
            : Promise.resolve(null);
        const [reviewListResult, myReviewResult] = await Promise.allSettled([
          reviewListRequest,
          myReviewRequest,
        ]);

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
                  comment: myReviewResult.value.comment,
                }
              : defaultReviewForm
          );
        } else {
          setReviewFeedback(getErrorMessage(myReviewResult.reason));
        }

        setIsReviewLoading(false);
      }

      try {
        const productResponse = await api.getProductById(productId);

        if (!active) {
          return;
        }

        await hydrateLiveProduct(productResponse.data);
      } catch (reason) {
        if (!active) {
          return;
        }

        if (workbookReference) {
          try {
            const resolvedLiveProduct = await findLiveProductForWorkbookReference(workbookReference);
            if (!active) {
              return;
            }

            if (resolvedLiveProduct) {
              await hydrateLiveProduct(resolvedLiveProduct);
              setFeedback("");
              return;
            }
          } catch {
            // Fall through to workbook-only preview mode when the live lookup cannot be resolved.
          }

          applyProductSnapshot(buildWorkbookFallbackProduct(workbookReference, productId));
          setIsWorkbookFallback(true);
          setFeedback(
            "San pham nay hien duoc render tu workbook CSV/XLSX. Hay dong bo product live trong trang admin de bat gio hang, ton kho va danh gia."
          );
          setIsReviewLoading(false);
          return;
        }

        setProduct(null);
        setFeedback(getErrorMessage(reason));
        setIsReviewLoading(false);
      }
    }

    void loadProductPage();

    return () => {
      active = false;
    };
  }, [applyProductSnapshot, content, isAuthenticated, productId, token]);

  useEffect(() => {
    let active = true;

    if (!product || isWorkbookFallback) {
      setRelatedProducts([]);
      return () => {
        active = false;
      };
    }

    void api
      .listProducts({
        category: product.category || undefined,
        status: "active",
        limit: 8,
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
  }, [isWorkbookFallback, product]);

  function redirectToLoginForProductAction(intent: PendingProductDetailActionIntent) {
    if (!product) {
      return;
    }

    const pendingAction = savePendingProductDetailAction({
      intent,
      productId: product.id,
      redirectTo: currentPath,
      quantity,
    });

    appendAuthFlowLog("product_detail_login_redirect_requested", {
      intent,
      productId: product.id,
      redirectTo: currentPath,
      quantity,
      pendingActionCreated: Boolean(pendingAction),
      loginRoute: "/login",
    });

    navigate("/login", {
      state: {
        from: location,
        message: buildProductActionLoginRequiredMessage(intent),
      },
    });
  }

  const addProductToCartAndRedirectToCart = useCallback(
    async (
      intent: PendingProductDetailActionIntent,
      nextQuantity: number,
      options: {
        isResume?: boolean;
      } = {}
    ) => {
      if (!product) {
        return;
      }

      const normalizedQuantity =
        Number.isInteger(nextQuantity) && nextQuantity > 0 ? nextQuantity : 1;
      const successEvent = options.isResume
        ? "product_detail_resume_cart_redirect_succeeded"
        : "product_detail_cart_redirect_succeeded";
      const failureEvent = options.isResume
        ? "product_detail_resume_failed"
        : "product_detail_cart_redirect_failed";

      try {
        setIsBusy(true);
        await addItem({
          product_id: product.id,
          quantity: normalizedQuantity,
        });

        if (options.isResume) {
          clearPendingPostLoginAction();
        }

        appendAuthFlowLog(successEvent, {
          intent,
          productId: product.id,
          quantity: normalizedQuantity,
          redirectTo: "/cart",
        });

        navigate("/cart", {
          state: {
            feedback: buildProductActionCartSuccessMessage(product.name, intent),
          },
        });
      } catch (reason) {
        if (options.isResume) {
          clearPendingPostLoginAction();
        }

        setFeedback(getErrorMessage(reason));
        appendAuthFlowLog(failureEvent, {
          intent,
          productId: product.id,
          quantity: normalizedQuantity,
          error: getErrorMessage(reason),
        });
      } finally {
        setIsBusy(false);
      }
    },
    [addItem, navigate, product]
  );

  useEffect(() => {
    if (!product || isWorkbookFallback || !isAuthenticated || isBootstrapping || !token) {
      return;
    }

    const pendingAction = readPendingProductDetailAction();
    if (
      !pendingAction ||
      pendingAction.productId !== product.id ||
      pendingAction.redirectTo !== currentPath
    ) {
      return;
    }

    const resumeKey = `${pendingAction.intent}:${pendingAction.productId}:${pendingAction.createdAt}`;
    if (resumedActionRef.current === resumeKey) {
      return;
    }
    resumedActionRef.current = resumeKey;

    appendAuthFlowLog("product_detail_resume_detected", {
      intent: pendingAction.intent,
      productId: pendingAction.productId,
      redirectTo: pendingAction.redirectTo,
      quantity: pendingAction.quantity,
    });

    void (async () => {
      await addProductToCartAndRedirectToCart(pendingAction.intent, pendingAction.quantity, {
        isResume: true,
      });
    })();
  }, [
    addProductToCartAndRedirectToCart,
    currentPath,
    isAuthenticated,
    isBootstrapping,
    isWorkbookFallback,
    product,
    token,
  ]);

  async function handleAddToCart() {
    if (!product) {
      return;
    }

    if (isWorkbookFallback) {
      setFeedback(
        "Muc nay dang hien thi tu workbook nen chua the them vao gio hang. Hay dong bo sang product live trong admin."
      );
      return;
    }

    if (!isAuthenticated) {
      redirectToLoginForProductAction("add_to_cart");
      return;
    }

    if (!token) {
      setFeedback("Phiên đăng nhập đang được khôi phục. Vui lòng thử lại sau vài giây.");
      return;
    }

    await addProductToCartAndRedirectToCart("add_to_cart", quantity);
  }

  async function handleBuyNow() {
    if (!product) {
      return;
    }

    if (isWorkbookFallback) {
      setFeedback(
        "Muc nay dang hien thi tu workbook nen chua the mua ngay. Hay dong bo sang product live trong admin."
      );
      return;
    }

    if (!isAuthenticated) {
      redirectToLoginForProductAction("buy_now");
      return;
    }

    if (!token) {
      setFeedback("Phiên đăng nhập đang được khôi phục. Vui lòng thử lại sau vài giây.");
      return;
    }

    await addProductToCartAndRedirectToCart("buy_now", quantity);
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
          : Promise.resolve(null),
      ]);

      setReviewList(reviewResponse.data);
      setMyReview(nextMyReview);
      setReviewForm(
        nextMyReview
          ? {
              rating: nextMyReview.rating,
              comment: nextMyReview.comment,
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
    if (isWorkbookFallback) {
      setReviewFeedback(
        "Danh gia chi kha dung sau khi san pham workbook duoc dong bo voi product live."
      );
      return;
    }

    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }

    document.getElementById("detail-review-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!product || isWorkbookFallback) {
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
          comment: reviewForm.comment.trim(),
        });
        await refreshReviews("Đánh giá của bạn đã được cập nhật.");
      } else {
        await api.createProductReview(token, product.id, {
          rating: reviewForm.rating,
          comment: reviewForm.comment.trim(),
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
    if (!product || !token || !myReview || isWorkbookFallback) {
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

  const productImages = product?.image_urls.length
    ? product.image_urls
    : product?.image_url
      ? [product.image_url]
      : [];
  const normalizedCategory = (product?.category ?? "").trim().toLowerCase();
  const isFootwear = normalizedCategory.includes("footwear");
  const isApparel =
    normalizedCategory.includes("shop men") ||
    normalizedCategory.includes("shop women") ||
    normalizedCategory === "men" ||
    normalizedCategory === "women";
  const selectedVariant =
    product?.variants.find((variant) => variant.sku === selectedVariantSku) ??
    product?.variants.find((variant) => variant.stock > 0) ??
    product?.variants[0] ??
    null;
  const activeStock = selectedVariant?.stock ?? product?.stock ?? 0;
  const activePrice = selectedVariant?.price ?? product?.price ?? 0;
  const stockToneClass =
    isWorkbookFallback || activeStock === 0
      ? "detail-stock-line detail-stock-line-out"
      : "detail-stock-line detail-stock-line-in";
  const stockToneCopy =
    isWorkbookFallback
      ? "Workbook preview only"
      : activeStock === 0
      ? "Hết hàng"
      : activeStock <= 2
        ? `Chỉ còn ${activeStock}`
        : `Còn hàng • ${activeStock} size/units`;
  const finishOptions = buildFinishOptions(product?.variants ?? []);
  const detailHighlights = product
    ? [
        {
          label: "Brand",
          value: product.brand || "ND Atelier",
        },
        {
          label: "Status",
          value: isWorkbookFallback ? "workbook-preview" : product.status || "active",
        },
        {
          label: "SKU",
          value: product.sku || "pending",
        },
        {
          label: "Stock",
          value: isWorkbookFallback
            ? "Workbook preview"
            : activeStock > 0
              ? `${activeStock} còn lại`
              : "Hết hàng",
        },
      ]
    : [];
  const alphaScale = ["XS", "S", "M", "L", "XL"];
  const sizeOptions = product
    ? buildSizeOptions(product.variants, { isApparel, isFootwear, alphaScale })
    : [];
  const averageRatingLabel =
    reviewList.summary.review_count > 0 ? reviewList.summary.average_rating.toFixed(1) : "0.0";
  const reviewSummaryStars = renderStars(Math.round(reviewList.summary.average_rating || 0));
  const reviewBreakdown = [
    { label: "5 sao", count: reviewList.summary.rating_breakdown.five },
    { label: "4 sao", count: reviewList.summary.rating_breakdown.four },
    { label: "3 sao", count: reviewList.summary.rating_breakdown.three },
    { label: "2 sao", count: reviewList.summary.rating_breakdown.two },
    { label: "1 sao", count: reviewList.summary.rating_breakdown.one },
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
                  <span className="detail-support-note">
                    {isWorkbookFallback
                      ? "Media dang duoc hien thi tu workbook storefront. Khi sync sang product live, anh se lay tu media URL/backend hien tai."
                      : "Media tu backend object storage / URL duoc cau hinh trong product service."}
                  </span>
                </div>
              </div>

              <div className="detail-copy detail-copy-editorial">
                <div className="detail-breadcrumbs">
                  <Link className="text-link" to="/products">
                    Catalog
                  </Link>
                  {product.category ? (
                    <Link
                      className="text-link"
                      to={`/categories/${encodeURIComponent(product.category)}`}
                    >
                      {product.category}
                    </Link>
                  ) : null}
                </div>

                <div className="detail-heading-block">
                  <div className="detail-badge-row">
                    <span className="section-kicker">{product.category || "atelier item"}</span>
                    {product.tags[0] ? (
                      <span className="product-tag-chip">#{product.tags[0]}</span>
                    ) : null}
                  </div>
                  <h1>{product.name}</h1>
                  <p className="detail-price-display">{formatCurrency(activePrice)}</p>
                </div>

                <p className="detail-description-editorial">
                  {product.description ||
                    "Không có mô tả chi tiết. Bạn vẫn có thể dùng trang này để test media, add-to-cart và checkout flow."}
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
                          className={
                            selectedVariant?.color === finish.name
                              ? "detail-finish-swatch detail-finish-swatch-active"
                              : "detail-finish-swatch"
                          }
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
                      <label>
                        {isFootwear ? "Standard Size" : isApparel ? "Size Còn Hàng" : "Kích cỡ"}
                      </label>
                      {isFootwear ? (
                        <span>Size Chart</span>
                      ) : selectedVariant?.sku ? (
                        <span>{selectedVariant.sku}</span>
                      ) : null}
                    </div>

                    <div
                      className={
                        isFootwear
                          ? "detail-size-grid detail-size-grid-footwear"
                          : "detail-size-grid"
                      }
                    >
                      {sizeOptions.map((option) => {
                        const isSelected = selectedVariantSku === option.variant?.sku;
                        const classes = [
                          "detail-size-button",
                          isSelected ? "detail-size-button-active" : "",
                          option.variant?.stock === 0 || !option.variant
                            ? "detail-size-button-unavailable"
                            : "",
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
                              <small
                                className={
                                  option.variant && option.variant.stock > 0
                                    ? "detail-size-note"
                                    : "detail-size-note detail-size-note-out"
                                }
                              >
                                {option.variant && option.variant.stock > 0
                                  ? `Còn ${option.variant.stock}`
                                  : "Hết Hàng"}
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
                      disabled={isWorkbookFallback}
                      max={activeStock || undefined}
                      min="1"
                      step="1"
                      type="number"
                      value={quantity}
                      onChange={(event) => {
                        const nextValue = Number.parseInt(event.target.value, 10) || 1;
                        setQuantity(
                          activeStock > 0 ? Math.min(Math.max(nextValue, 1), activeStock) : 1
                        );
                      }}
                    />
                  </label>

                  <div className="product-actions detail-actions-editorial">
                    <button
                      className="primary-button"
                      disabled={isWorkbookFallback || isBusy || activeStock === 0}
                      onClick={() => void handleAddToCart()}
                      type="button"
                    >
                      {isBusy ? "Đang thêm..." : "Add to Cart"}
                    </button>
                    <button
                      className="secondary-button"
                      disabled={isWorkbookFallback || isBusy || activeStock === 0}
                      onClick={() => void handleBuyNow()}
                      type="button"
                    >
                      Mua ngay
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {isWorkbookFallback ? (
              <section className="detail-review-section">
                <div className="detail-review-head">
                  <div>
                    <h2>Workbook Preview</h2>
                    <p className="detail-review-summary">
                      Muc nay dang hien thi tu workbook storefront nen review live tam thoi chua mo.
                    </p>
                  </div>
                </div>

                <div className="detail-review-empty">
                  <strong>Route chi tiet da san sang cho card workbook.</strong>
                  <span>
                    Khi san pham duoc dong bo bang ID live tu trang admin, khu vuc danh gia, ton kho
                    va mua hang se hoat dong day du.
                  </span>
                </div>
              </section>
            ) : (
              <section className="detail-review-section">
                <div className="detail-review-head">
                  <div>
                    <h2>The Wearer's Voice</h2>
                    <p className="detail-review-summary">
                      {reviewSummaryStars} {averageRatingLabel} dựa trên{" "}
                      {reviewList.summary.review_count} đánh giá
                    </p>
                  </div>
                  <button
                    className="detail-review-link"
                    type="button"
                    onClick={handleReviewCallToAction}
                  >
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
                          <strong>
                            {hasExistingReview ? "Đánh giá của bạn" : "Chia sẻ cảm nhận"}
                          </strong>
                          <span>
                            {hasExistingReview
                              ? "Bạn có thể chỉnh sửa số sao hoặc nội dung nhận xét bất kỳ lúc nào."
                              : "Chọn số sao và để lại nhận xét ngắn gọn cho sản phẩm này."}
                          </span>
                        </div>

                        <div
                          className="detail-review-star-row"
                          role="radiogroup"
                          aria-label="Chọn số sao"
                        >
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
                                comment: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <div className="detail-review-form-actions">
                          <button
                            className="primary-button"
                            disabled={reviewBusyAction !== ""}
                            type="submit"
                          >
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
                          Review chỉ dành cho người dùng đã đăng nhập. Sau khi đăng nhập, bạn sẽ
                          được quay lại đúng trang hiện tại để tiếp tục viết đánh giá.
                        </p>
                        <button
                          className="primary-button"
                          type="button"
                          onClick={handleReviewCallToAction}
                        >
                          Đi tới đăng nhập
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {reviewFeedback ? (
                  <div className="feedback feedback-info detail-review-feedback">
                    {reviewFeedback}
                  </div>
                ) : null}

                {isReviewLoading ? (
                  <div className="page-state">Đang tải đánh giá sản phẩm...</div>
                ) : reviewList.items.length > 0 ? (
                  <div className="detail-review-grid">
                    {reviewList.items.map((review) => (
                      <article className="detail-review-card" key={review.id}>
                        <div className="detail-review-card-head">
                          <span className="detail-review-stars">{renderStars(review.rating)}</span>
                          <span className="detail-review-date">
                            {formatReviewDate(review.updated_at || review.created_at)}
                          </span>
                        </div>
                        <p>
                          {review.comment ||
                            "Người dùng này đã chấm sao nhưng chưa để lại nhận xét chi tiết."}
                        </p>
                        <div className="detail-review-author">
                          <strong>{review.author_label}</strong>
                          <span>
                            {myReview?.id === review.id
                              ? "Đánh giá của bạn"
                              : "Người mua đã đăng nhập"}
                          </span>
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
            )}

            <section className="detail-look-section">
              <div className="detail-look-head">
                <h2>Complete The Look</h2>
              </div>

              <div className="detail-look-grid">
                {relatedProducts.map((item) => (
                  <Link className="detail-look-card" key={item.id} to={`/products/${item.id}`}>
                    <div className="detail-look-media">
                      {(item.image_urls[0] ?? item.image_url) ? (
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
    year: "numeric",
  });
}

async function findLiveProductForWorkbookReference(reference: HomeWorkbookProductReference) {
  const categoryCandidates = deriveWorkbookCategoryCandidatesFromReference(reference);
  const candidateBuckets: Product[] = [];

  if (categoryCandidates.length > 0) {
    const categoryResponses = await Promise.all(
      categoryCandidates.map((category) =>
        api
          .listProducts({
            status: "active",
            category,
            limit: 100,
          })
          .then((response) => response.data)
          .catch(() => [] as Product[])
      )
    );

    candidateBuckets.push(...categoryResponses.flat());
  }

  const searchResponse = await api
    .listProducts({
      status: "active",
      search: reference.name,
      limit: 24,
    })
    .then((response) => response.data)
    .catch(() => [] as Product[]);

  candidateBuckets.push(...searchResponse);

  const uniqueCandidates = dedupeWorkbookLiveProducts(candidateBuckets);
  const resolvedFromScopedCandidates = resolveWorkbookReferenceLiveProduct(
    reference,
    uniqueCandidates
  );
  if (resolvedFromScopedCandidates) {
    return resolvedFromScopedCandidates;
  }

  const fallbackResponse = await api.listProducts({
    status: "active",
    limit: 100,
  });

  return resolveWorkbookReferenceLiveProduct(reference, [
    ...uniqueCandidates,
    ...fallbackResponse.data,
  ]);
}

function resolveWorkbookReferenceLiveProduct(
  reference: HomeWorkbookProductReference,
  candidates: Product[]
) {
  return selectLiveProductForWorkbookEntry(reference, dedupeWorkbookLiveProducts(candidates));
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
  const hasAlphaSizes = variants.some((variant) =>
    /^[A-Za-z]+$/.test(normalizeSizeLabel(variant.size || variant.label))
  );
  const baseSizes =
    options.isApparel && hasAlphaSizes
      ? options.alphaScale
      : Array.from(
          new Set(variants.map((variant) => normalizeSizeLabel(variant.size || variant.label)))
        );

  return baseSizes.map((size) => ({
    key: size,
    label: options.isFootwear ? size.padStart(2, "0") : size,
    variant: variantsBySize.get(size) ?? null,
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
    oak: "#8c6a44",
  };

  return Array.from(
    new Set(variants.map((variant) => (variant.color ?? "").trim().toLowerCase()).filter(Boolean))
  ).map((name) => ({
    name,
    swatch: swatchMap[name] ?? "#737973",
  }));
}
