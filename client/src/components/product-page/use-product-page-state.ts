"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { useAuthState } from "@/hooks/useAuth";
import { useCartActions } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { productApi } from "@/lib/api/product";
import { getErrorMessage } from "@/lib/errors/handler";
import type { ProductPageInitialData } from "@/lib/storefront/initial-data";
import { fallbackImageForProduct, getProductImages } from "@/lib/utils";
import type { Product, ProductReview, ProductReviewList } from "@/types/api";

import {
  emptyReviewList,
  getDefaultVariant,
  getMyProductReviewOrNull,
  getSelectedVariant,
  type ProductPageBusyState,
  type ReviewFormState,
} from "./shared";

export function useProductPageState(
  productId: string,
  initialData?: ProductPageInitialData,
) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, isAuthenticated } = useAuthState();
  const { addItem } = useCartActions();
  const { isSaved, toggleWishlist } = useWishlist();
  const skipInitialProductLoad = useRef(Boolean(initialData));

  const [product, setProduct] = useState<Product | null>(initialData?.product ?? null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [reviewList, setReviewList] = useState<ProductReviewList>(
    initialData?.reviewList ?? emptyReviewList,
  );
  const [myReview, setMyReview] = useState<ProductReview | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>({ rating: 0, comment: "" });
  const [selectedVariantSku, setSelectedVariantSku] = useState(
    initialData?.product ? (getDefaultVariant(initialData.product)?.sku ?? "") : "",
  );
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(() => {
    if (!initialData?.product) {
      return "";
    }

    const images = getProductImages(initialData.product.image_url, initialData.product.image_urls);
    return images[0] || fallbackImageForProduct(initialData.product.name);
  });
  const [feedback, setFeedback] = useState(initialData?.feedback ?? "");
  const [reviewFeedback, setReviewFeedback] = useState(initialData?.reviewFeedback ?? "");
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isReviewLoading, setIsReviewLoading] = useState(!initialData);
  const [busy, setBusy] = useState<ProductPageBusyState>("");

  useEffect(() => {
    if (skipInitialProductLoad.current) {
      skipInitialProductLoad.current = false;
      setIsLoading(false);
      setIsReviewLoading(false);
      return;
    }

    let active = true;

    setIsLoading(true);
    setIsReviewLoading(true);

    // Load product details and public reviews in parallel for the initial page view.
    void Promise.allSettled([
      productApi.getProductById(productId),
      productApi.listProductReviews(productId, { page: 1, limit: 8 }),
    ]).then(([productResult, reviewResult]) => {
        if (!active) {
          return;
        }

        if (productResult.status === "fulfilled") {
          const nextProduct = productResult.value.data;
          setProduct(nextProduct);
          const images = getProductImages(nextProduct.image_url, nextProduct.image_urls);
          setActiveImage(images[0] || fallbackImageForProduct(nextProduct.name));
          setSelectedVariantSku(getDefaultVariant(nextProduct)?.sku ?? "");
        } else {
          setFeedback(getErrorMessage(productResult.reason));
        }

        if (reviewResult.status === "fulfilled") {
          setReviewList(reviewResult.value.data);
        } else {
          setReviewFeedback(getErrorMessage(reviewResult.reason));
        }

        setIsLoading(false);
        setIsReviewLoading(false);
      },
    );

    return () => {
      active = false;
    };
  }, [productId]);

  useEffect(() => {
    let active = true;

    if (!isAuthenticated || !token) {
      setMyReview(null);
      setReviewForm({ rating: 0, comment: "" });
      return () => {
        active = false;
      };
    }

    void getMyProductReviewOrNull(token, productId)
      .then((nextMyReview) => {
        if (!active) {
          return;
        }

        setMyReview(nextMyReview);
        setReviewForm(
          nextMyReview
            ? { rating: nextMyReview.rating, comment: nextMyReview.comment }
            : { rating: 0, comment: "" },
        );
      })
      .catch((reason) => {
        if (active) {
          setReviewFeedback(getErrorMessage(reason));
        }
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
  const selectedVariant = getSelectedVariant(product, selectedVariantSku);
  const effectivePrice = selectedVariant?.price ?? product?.price ?? 0;
  const effectiveStock = selectedVariant?.stock ?? product?.stock ?? 0;

  function requireAuth() {
    router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
  }

  function updateQuantity(nextQuantity: number) {
    setQuantity(Math.max(1, Math.min(Math.max(effectiveStock, 1), nextQuantity)));
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
        isAuthenticated && token ? getMyProductReviewOrNull(token, product.id) : Promise.resolve(null),
      ]);

      setReviewList(reviewResponse.data);
      setMyReview(nextMyReview);
      setReviewFeedback(message);
      setReviewForm(
        nextMyReview
          ? { rating: nextMyReview.rating, comment: nextMyReview.comment }
          : { rating: 0, comment: "" },
      );
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

  function handleBuyNow() {
    if (!product) {
      return;
    }

    router.push(`/checkout?buy_now=${encodeURIComponent(product.id)}&qty=${quantity}`);
  }

  function handleViewRelatedProduct(nextProductId: string) {
    router.push(`/products/${nextProductId}`);
  }

  return {
    activeImage,
    busy,
    effectivePrice,
    effectiveStock,
    feedback,
    images,
    isAuthenticated,
    isLoading,
    isReviewLoading,
    isSaved,
    myReview,
    product,
    quantity,
    relatedProducts,
    requireAuth,
    reviewFeedback,
    reviewForm,
    reviewList,
    selectedVariant,
    selectedVariantSku,
    setActiveImage,
    setReviewForm,
    setSelectedVariantSku,
    toggleWishlist,
    updateQuantity,
    handleAddToCart,
    handleBuyNow,
    handleDeleteReview,
    handleReviewSubmit,
    handleViewRelatedProduct,
  };
}
