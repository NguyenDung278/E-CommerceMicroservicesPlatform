"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { productApi } from "@/lib/api/product";
import { getErrorMessage } from "@/lib/errors/handler";
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

export function useProductPageState(productId: string) {
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
  const [busy, setBusy] = useState<ProductPageBusyState>("");

  useEffect(() => {
    let active = true;

    const productRequest = productApi.getProductById(productId);
    const reviewRequest = productApi.listProductReviews(productId, { page: 1, limit: 8 });
    const myReviewRequest =
      isAuthenticated && token ? getMyProductReviewOrNull(token, productId) : Promise.resolve(null);

    setIsLoading(true);
    setIsReviewLoading(true);

    // Load product, public reviews and the current user's review in parallel to keep the page responsive.
    void Promise.allSettled([productRequest, reviewRequest, myReviewRequest]).then(
      ([productResult, reviewResult, myReviewResult]) => {
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
      },
    );

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
