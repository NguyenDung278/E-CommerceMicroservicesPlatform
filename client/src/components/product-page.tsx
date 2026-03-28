"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, LoaderCircle, Minus, Plus, ShoppingBag, Star } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { StorefrontImage } from "@/components/storefront-image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  EmptyState,
  Field,
  InlineAlert,
  LoadingScreen,
  ProductCard,
  ProductCardAction,
  SectionHeading,
  Select,
  SurfaceCard,
  TextArea,
} from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { productApi } from "@/lib/api/product";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage, isHttpError } from "@/lib/errors/handler";
import { cn, fallbackImageForProduct, getProductImages } from "@/lib/utils";
import type {
  Product,
  ProductReview,
  ProductReviewList,
  ProductReviewSummary,
  ProductVariant,
} from "@/types/api";
import { formatCurrency, formatLongDate } from "@/utils/format";

type ReviewFormState = {
  rating: number;
  comment: string;
};

const emptyReviewSummary: ProductReviewSummary = {
  average_rating: 0,
  review_count: 0,
  rating_breakdown: { one: 0, two: 0, three: 0, four: 0, five: 0 },
};

const emptyReviewList: ProductReviewList = {
  summary: emptyReviewSummary,
  items: [],
};

export function ProductPage({ productId }: { productId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const { isSaved, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [reviewList, setReviewList] = useState<ProductReviewList>(emptyReviewList);
  const [myReview, setMyReview] = useState<ProductReview | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>({ rating: 0, comment: "" });
  const [selectedVariantSku, setSelectedVariantSku] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewLoading, setIsReviewLoading] = useState(true);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let active = true;

    const productRequest = productApi.getProductById(productId);
    const reviewRequest = productApi.listProductReviews(productId, { page: 1, limit: 8 });
    const myReviewRequest =
      isAuthenticated && token
        ? productApi
            .getMyProductReview(token, productId)
            .then((response) => response.data)
            .catch((reason) => {
              if (isHttpError(reason) && reason.status === 404) {
                return null;
              }
              throw reason;
            })
        : Promise.resolve(null);

    setIsLoading(true);
    setIsReviewLoading(true);
    void Promise.allSettled([productRequest, reviewRequest, myReviewRequest]).then(([productResult, reviewResult, myReviewResult]) => {
      if (!active) {
        return;
      }

      if (productResult.status === "fulfilled") {
        const nextProduct = productResult.value.data;
        setProduct(nextProduct);
        const images = getProductImages(nextProduct.image_url, nextProduct.image_urls);
        setActiveImage(images[0] || fallbackImageForProduct(nextProduct.name));
        const defaultVariant = nextProduct.variants.find((variant) => variant.stock > 0) ?? nextProduct.variants[0];
        setSelectedVariantSku(defaultVariant?.sku ?? "");
      } else {
        setFeedback(getErrorMessage(productResult.reason));
      }

      if (reviewResult.status === "fulfilled") {
        setReviewList(reviewResult.value.data);
      } else {
        setReviewFeedback(getErrorMessage(reviewResult.reason));
      }

      if (myReviewResult.status === "fulfilled") {
        setMyReview(myReviewResult.value);
        setReviewForm(
          myReviewResult.value
            ? { rating: myReviewResult.value.rating, comment: myReviewResult.value.comment }
            : { rating: 0, comment: "" },
        );
      } else {
        setReviewFeedback(getErrorMessage(myReviewResult.reason));
      }

      setIsLoading(false);
      setIsReviewLoading(false);
    });

    return () => {
      active = false;
    };
  }, [isAuthenticated, productId, token]);

  useEffect(() => {
    let active = true;

    if (!product?.category) {
      setRelatedProducts([]);
      return () => {
        active = false;
      };
    }

    void productApi
      .listProducts({ category: product.category, status: "active", limit: 8 })
      .then((response) => {
        if (active) {
          setRelatedProducts(response.data.filter((item) => item.id !== product.id).slice(0, 4));
        }
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

  const images = product ? getProductImages(product.image_url, product.image_urls) : [];
  const selectedVariant: ProductVariant | null =
    product?.variants.find((variant) => variant.sku === selectedVariantSku) ??
    product?.variants.find((variant) => variant.stock > 0) ??
    product?.variants[0] ??
    null;
  const effectivePrice = selectedVariant?.price ?? product?.price ?? 0;
  const effectiveStock = selectedVariant?.stock ?? product?.stock ?? 0;

  function requireAuth() {
    router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  async function handleAddToCart() {
    if (!product) {
      return;
    }

    try {
      setBusy("cart");
      await addItem({ product_id: product.id, quantity });
      setFeedback("Đã thêm sản phẩm vào giỏ hàng.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy("");
    }
  }

  async function refreshReviews(message = "") {
    if (!product) {
      return;
    }

    setIsReviewLoading(true);
    try {
      const [reviewResponse, nextMyReview] = await Promise.all([
        productApi.listProductReviews(product.id, { page: 1, limit: 8 }),
        isAuthenticated && token
          ? productApi
              .getMyProductReview(token, product.id)
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
      setReviewFeedback(message);
      setReviewForm(nextMyReview ? { rating: nextMyReview.rating, comment: nextMyReview.comment } : { rating: 0, comment: "" });
    } catch (reason) {
      setReviewFeedback(getErrorMessage(reason));
    } finally {
      setIsReviewLoading(false);
    }
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!product) {
      return;
    }

    if (!isAuthenticated || !token) {
      requireAuth();
      return;
    }

    if (reviewForm.rating < 1 || reviewForm.rating > 5) {
      setReviewFeedback("Hãy chọn số sao từ 1 đến 5.");
      return;
    }

    try {
      setBusy("review");
      if (myReview) {
        await productApi.updateMyProductReview(token, product.id, reviewForm);
        await refreshReviews("Đánh giá của bạn đã được cập nhật.");
      } else {
        await productApi.createProductReview(token, product.id, reviewForm);
        await refreshReviews("Cảm ơn bạn đã gửi đánh giá.");
      }
    } catch (reason) {
      setReviewFeedback(getErrorMessage(reason));
    } finally {
      setBusy("");
    }
  }

  async function handleDeleteReview() {
    if (!product || !token) {
      return;
    }

    try {
      setBusy("delete-review");
      await productApi.deleteMyProductReview(token, product.id);
      await refreshReviews("Đánh giá của bạn đã được xóa.");
    } catch (reason) {
      setReviewFeedback(getErrorMessage(reason));
    } finally {
      setBusy("");
    }
  }

  if (isLoading) {
    return (
      <>
        <SiteHeader />
        <LoadingScreen label="Đang tải chi tiết sản phẩm..." />
        <SiteFooter />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <SiteHeader />
        <main className="shell section-spacing">
          <EmptyState
            title="Không tìm thấy sản phẩm"
            description="ID sản phẩm có thể không tồn tại hoặc không còn khả dụng trong catalog active."
            action={
              <Link href="/products" className={buttonStyles({ variant: "secondary" })}>
                Quay lại catalog
              </Link>
            }
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="shell section-spacing space-y-16">
        {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

        <section className="grid gap-10 lg:grid-cols-[1.08fr_minmax(0,0.92fr)] lg:items-start">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[1.25rem] bg-surface-container-low p-3">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1rem] bg-surface">
                <StorefrontImage
                  alt={product.name}
                  src={activeImage || images[0] || fallbackImageForProduct(product.name)}
                  fill
                  priority
                  sizes="(min-width: 1024px) 52vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {(images.length ? images : [fallbackImageForProduct(product.name)]).slice(0, 4).map((image) => (
                <button
                  key={image}
                  type="button"
                  className={cn("overflow-hidden rounded-[1rem] bg-surface-container-low", activeImage === image && "ring-2 ring-primary/20")}
                  onClick={() => setActiveImage(image)}
                >
                  <div className="relative aspect-square">
                    <StorefrontImage
                      alt={product.name}
                      src={image}
                      fill
                      sizes="(min-width: 1024px) 12vw, 24vw"
                      className="object-cover"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6 lg:sticky lg:top-28">
            <div className="rounded-[1.25rem] bg-surface-container-low px-6 py-8 md:px-8">
              <p className="eyebrow">{product.category || "Catalog"}</p>
              <h1 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary md:text-5xl">
                {product.name}
              </h1>
              <p className="mt-5 text-base leading-8 text-on-surface-variant">{product.description}</p>

              <div className="mt-7 flex items-center justify-between gap-4">
                <div>
                  <strong className="block font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">
                    {formatCurrency(effectivePrice)}
                  </strong>
                  <span className="mt-2 block text-sm text-on-surface-variant">
                    {effectiveStock <= 0 ? "Hết hàng" : effectiveStock <= 5 ? `Còn ${effectiveStock} sản phẩm` : "Còn hàng"}
                  </span>
                </div>
                <button
                  type="button"
                  className={cn(buttonStyles({ variant: "secondary" }), "shrink-0")}
                  onClick={() => toggleWishlist(product.id)}
                >
                  <Heart className="h-4 w-4" />
                  {isSaved(product.id) ? "Đã lưu" : "Yêu thích"}
                </button>
              </div>
            </div>

            <SurfaceCard className="p-6">
              <div className="grid gap-5">
                {product.variants.length > 0 ? (
                  <Field htmlFor="variant-select" label="Biến thể">
                    <Select id="variant-select" value={selectedVariantSku} onChange={(event) => setSelectedVariantSku(event.target.value)}>
                      {product.variants.map((variant) => (
                        <option key={variant.sku} value={variant.sku}>
                          {variant.label}
                          {variant.color ? ` - ${variant.color}` : ""}
                          {variant.size ? ` - ${variant.size}` : ""}
                          {variant.stock <= 0 ? " (Hết hàng)" : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}

                <div className="flex items-center gap-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                    Số lượng
                  </span>
                  <div className="flex items-center gap-3 rounded-full bg-surface px-3 py-2">
                    <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-primary" onClick={() => setQuantity((current) => Math.max(1, current - 1))}>
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-6 text-center text-sm font-semibold text-primary">{quantity}</span>
                    <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-primary" onClick={() => setQuantity((current) => Math.min(Math.max(effectiveStock, 1), current + 1))}>
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
                  <button type="button" className={cn(buttonStyles({ size: "lg" }), "w-full md:flex-1")} disabled={effectiveStock <= 0 || busy === "cart"} onClick={() => void handleAddToCart()}>
                    {busy === "cart" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                    <span>{busy === "cart" ? "Đang thêm..." : "Thêm vào giỏ"}</span>
                  </button>
                  <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full md:flex-1")} disabled={effectiveStock <= 0} onClick={() => router.push(`/checkout?buy_now=${encodeURIComponent(product.id)}&qty=${quantity}`)}>
                    Mua ngay
                  </button>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">SKU</p>
                  <p className="mt-2 text-sm text-primary">{selectedVariant?.sku || product.sku || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">Brand</p>
                  <p className="mt-2 text-sm text-primary">{product.brand || "Commerce Platform"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">Cập nhật</p>
                  <p className="mt-2 text-sm text-primary">{formatLongDate(product.updated_at)}</p>
                </div>
              </div>
            </SurfaceCard>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <SectionHeading
              eyebrow="Reviews"
              title="Đánh giá thật từ product-service."
              description="Luồng review dùng đúng contract hiện có: xem danh sách, xem đánh giá của tôi, tạo, sửa và xóa."
            />
            {reviewFeedback ? <div className="mt-6"><InlineAlert tone="info">{reviewFeedback}</InlineAlert></div> : null}
            <div className="mt-8 grid gap-4">
              {isReviewLoading ? (
                <LoadingScreen label="Đang tải đánh giá..." />
              ) : reviewList.items.length === 0 ? (
                <SurfaceCard className="p-6">
                  <p className="text-sm text-on-surface-variant">Chưa có đánh giá nào cho sản phẩm này.</p>
                </SurfaceCard>
              ) : (
                reviewList.items.map((review) => (
                  <SurfaceCard key={review.id} className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-primary">{review.author_label || "Người mua hàng"}</p>
                        <p className="mt-2 flex items-center gap-1 text-tertiary">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star key={index} className={cn("h-4 w-4", index < review.rating && "fill-current")} />
                          ))}
                        </p>
                      </div>
                      <span className="text-sm text-on-surface-variant">{formatLongDate(review.created_at)}</span>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-on-surface-variant">{review.comment || "Không có nhận xét chi tiết."}</p>
                  </SurfaceCard>
                ))
              )}
            </div>
          </div>

          <SurfaceCard className="h-fit p-6">
            <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
              {myReview ? "Cập nhật đánh giá của bạn" : "Viết đánh giá"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-on-surface-variant">
              {isAuthenticated ? "Hãy đánh giá trải nghiệm thực tế của bạn với sản phẩm này." : "Bạn cần đăng nhập để gửi đánh giá."}
            </p>

            <form className="mt-6 space-y-5" onSubmit={handleReviewSubmit}>
              <Field htmlFor="review-rating" label="Số sao" required>
                <div id="review-rating" className="flex items-center gap-2">
                  {Array.from({ length: 5 }).map((_, index) => {
                    const rating = index + 1;
                    return (
                      <button
                        key={rating}
                        type="button"
                        className={cn("inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-outline transition hover:text-tertiary", reviewForm.rating >= rating && "text-tertiary")}
                        onClick={() => setReviewForm((current) => ({ ...current, rating }))}
                      >
                        <Star className={cn("h-5 w-5", reviewForm.rating >= rating && "fill-current")} />
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field htmlFor="review-comment" label="Nhận xét">
                <TextArea id="review-comment" placeholder="Điểm nổi bật, chất lượng, kích cỡ, thời gian giao hàng..." value={reviewForm.comment} onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))} />
              </Field>

              {!isAuthenticated ? (
                <button type="button" className={cn(buttonStyles({ size: "lg" }), "w-full")} onClick={requireAuth}>
                  Đăng nhập để đánh giá
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <button type="submit" className={cn(buttonStyles({ size: "lg" }), "w-full")} disabled={busy === "review"}>
                    {busy === "review" ? "Đang gửi..." : myReview ? "Cập nhật đánh giá" : "Gửi đánh giá"}
                  </button>
                  {myReview ? (
                    <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")} disabled={busy === "delete-review"} onClick={() => void handleDeleteReview()}>
                      {busy === "delete-review" ? "Đang xóa..." : "Xóa đánh giá"}
                    </button>
                  ) : null}
                </div>
              )}
            </form>
          </SurfaceCard>
        </section>

        <section>
          <SectionHeading eyebrow="Liên quan" title="Sản phẩm cùng category" description="Dùng tiếp dữ liệu thật từ catalog để giúp người dùng khám phá thêm." />
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {relatedProducts.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                saved={isSaved(item.id)}
                actionSlot={<ProductCardAction onClick={() => router.push(`/products/${item.id}`)} label="Xem sản phẩm" />}
              />
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
