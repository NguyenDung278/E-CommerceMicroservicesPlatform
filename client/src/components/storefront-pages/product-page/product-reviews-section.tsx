"use client";

import { Star } from "lucide-react";
import { type FormEvent } from "react";

import {
  Field,
  InlineAlert,
  LoadingScreen,
  SectionHeading,
  TextArea,
} from "@/components/storefront-shared/storefront-ui";
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
  const reviewCount = reviewList.summary.review_count;
  const averageRating =
    reviewCount > 0 ? reviewList.summary.average_rating.toFixed(1) : "0.0";
  const ratingBreakdown = [
    { label: "5 sao", count: reviewList.summary.rating_breakdown.five },
    { label: "4 sao", count: reviewList.summary.rating_breakdown.four },
    { label: "3 sao", count: reviewList.summary.rating_breakdown.three },
    { label: "2 sao", count: reviewList.summary.rating_breakdown.two },
    { label: "1 sao", count: reviewList.summary.rating_breakdown.one },
  ];

  return (
    <section className="detail-review-section">
      <div className="detail-review-head">
        <SectionHeading
          eyebrow="Đánh giá"
          title="Phản hồi thật từ người đã mua."
          description="Xem nhanh điểm trung bình, phân bổ số sao và toàn bộ nhận xét để dễ quyết định hơn trước khi mua."
        />
        <p className="detail-review-summary">
          {reviewCount > 0
            ? `${reviewCount} đánh giá đã được ghi nhận cho sản phẩm này.`
            : "Sản phẩm chưa có đánh giá nào, bạn có thể là người đầu tiên để lại nhận xét."}
        </p>
      </div>

      <div className="detail-review-shell">
        <div className="detail-review-summary-panel">
          <div className="detail-review-average">
            <span>• • • • •</span>
            <strong>{averageRating}</strong>
            <p>
              {reviewCount > 0
                ? `Điểm trung bình từ ${reviewCount} lượt đánh giá đã xác thực.`
                : "Chưa đủ dữ liệu để tạo điểm trung bình cho sản phẩm này."}
            </p>
          </div>

          <div className="detail-review-breakdown">
            {ratingBreakdown.map((entry) => {
              const percent =
                reviewCount > 0 ? Math.round((entry.count / reviewCount) * 100) : 0;

              return (
                <div key={entry.label} className="detail-review-breakdown-row">
                  <span className="detail-review-breakdown-label">{entry.label}</span>
                  <div className="detail-review-breakdown-track">
                    <span
                      className="detail-review-breakdown-fill"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="detail-review-breakdown-count">{entry.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="detail-review-form-panel">
          <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
            {myReview ? "Cập nhật đánh giá của bạn" : "Viết đánh giá"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">
            {isAuthenticated
              ? "Hãy mô tả cảm nhận thực tế về chất liệu, kích cỡ, hoàn thiện và trải nghiệm giao hàng."
              : "Bạn cần đăng nhập để gửi đánh giá và lưu nhận xét vào hồ sơ tài khoản."}
          </p>

          {reviewFeedback ? (
            <InlineAlert tone="info">{reviewFeedback}</InlineAlert>
          ) : null}

          <form className="detail-review-form mt-6 space-y-5" onSubmit={onSubmit}>
            <Field htmlFor="review-rating" label="Số sao" required>
              <div id="review-rating" className="detail-review-star-row">
                {Array.from({ length: 5 }).map((_, index) => {
                  const rating = index + 1;
                  return (
                    <button
                      key={rating}
                      type="button"
                      className={cn(
                        "detail-review-star-button",
                        reviewForm.rating >= rating && "detail-review-star-button-active",
                      )}
                      onClick={() => onRatingChange(rating)}
                    >
                      <span>★</span>
                      <span>{rating} sao</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field htmlFor="review-comment" label="Nhận xét">
              <TextArea
                id="review-comment"
                className="detail-review-textarea"
                placeholder="Chia sẻ về form dáng, chất liệu, màu sắc, thời gian giao và cảm giác sử dụng thực tế..."
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
              <div className="detail-review-form-actions">
                <button
                  type="submit"
                  className={cn(buttonStyles({ size: "lg" }), "w-full")}
                  disabled={busy === "review"}
                >
                  {busy === "review"
                    ? "Đang gửi..."
                    : myReview
                      ? "Cập nhật đánh giá"
                      : "Gửi đánh giá"}
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
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        {isReviewLoading ? (
          <LoadingScreen label="Đang tải đánh giá..." />
        ) : reviewList.items.length === 0 ? (
          <div className="detail-review-empty">
            <span>Chưa có đánh giá</span>
            <p>Hãy là người đầu tiên cho biết sản phẩm này lên dáng và hoàn thiện ra sao.</p>
          </div>
        ) : (
          <div className="detail-review-grid">
            {reviewList.items.map((review) => (
              <article key={review.id} className="detail-review-card">
                <div className="detail-review-card-head">
                  <div>
                    <p className="detail-review-stars">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          className={cn("h-4 w-4", index < review.rating && "fill-current")}
                        />
                      ))}
                    </p>
                    <div className="detail-review-author mt-4">
                      <strong>{review.author_label || "Người mua đã xác minh"}</strong>
                      <span>Đã mua hàng</span>
                    </div>
                  </div>
                  <span className="detail-review-date">
                    {formatLongDate(review.created_at)}
                  </span>
                </div>
                <p>{review.comment || "Không có nhận xét chi tiết."}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
