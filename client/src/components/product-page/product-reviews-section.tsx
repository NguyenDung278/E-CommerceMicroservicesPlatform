"use client";

import { Star } from "lucide-react";
import { type FormEvent } from "react";

import {
  Field,
  InlineAlert,
  LoadingScreen,
  SectionHeading,
  SurfaceCard,
  TextArea,
} from "@/components/storefront-ui";
import { buttonStyles } from "@/lib/button-styles";
import { cn } from "@/lib/utils";
import type { ProductReview, ProductReviewList } from "@/types/api";
import { formatLongDate } from "@/utils/format";

import type { ProductPageBusyState, ReviewFormState } from "./shared";

type ProductReviewsSectionProps = {
  busy: ProductPageBusyState;
  isAuthenticated: boolean;
  isReviewLoading: boolean;
  myReview: ProductReview | null;
  onCommentChange: (comment: string) => void;
  onDeleteReview: () => void;
  onRatingChange: (rating: number) => void;
  onRequireAuth: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  reviewFeedback: string;
  reviewForm: ReviewFormState;
  reviewList: ProductReviewList;
};

export function ProductReviewsSection({
  busy,
  isAuthenticated,
  isReviewLoading,
  myReview,
  onCommentChange,
  onDeleteReview,
  onRatingChange,
  onRequireAuth,
  onSubmit,
  reviewFeedback,
  reviewForm,
  reviewList,
}: ProductReviewsSectionProps) {
  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div>
        <SectionHeading
          eyebrow="Reviews"
          title="Đánh giá thật từ product-service."
          description="Luồng review dùng đúng contract hiện có: xem danh sách, xem đánh giá của tôi, tạo, sửa và xóa."
        />
        {reviewFeedback ? (
          <div className="mt-6">
            <InlineAlert tone="info">{reviewFeedback}</InlineAlert>
          </div>
        ) : null}
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
                        <Star
                          key={index}
                          className={cn("h-4 w-4", index < review.rating && "fill-current")}
                        />
                      ))}
                    </p>
                  </div>
                  <span className="text-sm text-on-surface-variant">{formatLongDate(review.created_at)}</span>
                </div>
                <p className="mt-4 text-sm leading-7 text-on-surface-variant">
                  {review.comment || "Không có nhận xét chi tiết."}
                </p>
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
          {isAuthenticated
            ? "Hãy đánh giá trải nghiệm thực tế của bạn với sản phẩm này."
            : "Bạn cần đăng nhập để gửi đánh giá."}
        </p>

        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <Field htmlFor="review-rating" label="Số sao" required>
            <div id="review-rating" className="flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, index) => {
                const rating = index + 1;
                return (
                  <button
                    key={rating}
                    type="button"
                    className={cn(
                      "inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-outline transition hover:text-tertiary",
                      reviewForm.rating >= rating && "text-tertiary",
                    )}
                    onClick={() => onRatingChange(rating)}
                  >
                    <Star className={cn("h-5 w-5", reviewForm.rating >= rating && "fill-current")} />
                  </button>
                );
              })}
            </div>
          </Field>

          <Field htmlFor="review-comment" label="Nhận xét">
            <TextArea
              id="review-comment"
              placeholder="Điểm nổi bật, chất lượng, kích cỡ, thời gian giao hàng..."
              value={reviewForm.comment}
              onChange={(event) => onCommentChange(event.target.value)}
            />
          </Field>

          {!isAuthenticated ? (
            <button
              type="button"
              className={cn(buttonStyles({ size: "lg" }), "w-full")}
              onClick={onRequireAuth}
            >
              Đăng nhập để đánh giá
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                className={cn(buttonStyles({ size: "lg" }), "w-full")}
                disabled={busy === "review"}
              >
                {busy === "review" ? "Đang gửi..." : myReview ? "Cập nhật đánh giá" : "Gửi đánh giá"}
              </button>
              {myReview ? (
                <button
                  type="button"
                  className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")}
                  disabled={busy === "delete-review"}
                  onClick={onDeleteReview}
                >
                  {busy === "delete-review" ? "Đang xóa..." : "Xóa đánh giá"}
                </button>
              ) : null}
            </div>
          )}
        </form>
      </SurfaceCard>
    </section>
  );
}
