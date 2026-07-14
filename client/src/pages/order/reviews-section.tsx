import { PackageCheck, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../services/http";
import {
  createProductReview,
  deleteMyProductReview,
  getMyProductReview,
  updateMyProductReview,
} from "../../services/product-service";
import { useAuth } from "../../state/auth-context";
import type { Order, ProductReview } from "../../types/api";

type ReviewDraft = {
  rating: number;
  comment: string;
  existing: ProductReview | null;
  submitting: boolean;
  error: string | null;
  status: string | null;
};

function buildReviewDraft(review: ProductReview | null): ReviewDraft {
  return {
    rating: review?.rating ?? 5,
    comment: review?.comment ?? "",
    existing: review,
    submitting: false,
    error: null,
    status: null,
  };
}

/**
 * Đánh giá sau mua cho từng sản phẩm trong đơn — chỉ render khi đơn đã
 * `delivered` (backend cũng chặn review khi chưa giao). Review hiện có của
 * user được nạp theo từng product khi mount.
 */
export function ReviewsSection({ order }: { order: Order }) {
  const { token } = useAuth();
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      if (!token || order.status !== "delivered") {
        setReviewDrafts({});
        return;
      }

      const productIds = Array.from(new Set(order.items.map((item) => item.product_id)));
      const drafts = await Promise.all(
        productIds.map(async (productId) => {
          try {
            const review = await getMyProductReview(token, productId);
            return [productId, buildReviewDraft(review)] as const;
          } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
              return [productId, buildReviewDraft(null)] as const;
            }
            return [
              productId,
              {
                ...buildReviewDraft(null),
                error: err instanceof Error ? err.message : "Không tải được review",
              },
            ] as const;
          }
        }),
      );
      if (active) {
        setReviewDrafts(Object.fromEntries(drafts));
      }
    }

    void loadReviews();

    return () => {
      active = false;
    };
  }, [token, order]);

  function updateReviewDraft(productId: string, patch: Partial<ReviewDraft>) {
    setReviewDrafts((current) => ({
      ...current,
      [productId]: {
        ...(current[productId] ?? buildReviewDraft(null)),
        ...patch,
      },
    }));
  }

  async function saveReview(productId: string) {
    if (!token) {
      return;
    }

    const draft = reviewDrafts[productId] ?? buildReviewDraft(null);
    try {
      updateReviewDraft(productId, { submitting: true, error: null, status: null });
      const payload = { rating: draft.rating, comment: draft.comment.trim() };
      const saved = draft.existing
        ? await updateMyProductReview(token, productId, payload)
        : await createProductReview(token, productId, payload);
      updateReviewDraft(productId, {
        existing: saved,
        rating: saved.rating,
        comment: saved.comment,
        submitting: false,
        status: draft.existing ? "Đã cập nhật review" : "Đã gửi review",
      });
    } catch (err) {
      updateReviewDraft(productId, {
        submitting: false,
        error: err instanceof Error ? err.message : "Không lưu được review",
      });
    }
  }

  async function removeReview(productId: string) {
    if (!token || !reviewDrafts[productId]?.existing) {
      return;
    }

    try {
      updateReviewDraft(productId, { submitting: true, error: null, status: null });
      await deleteMyProductReview(token, productId);
      updateReviewDraft(productId, {
        ...buildReviewDraft(null),
        status: "Đã xóa review",
      });
    } catch (err) {
      updateReviewDraft(productId, {
        submitting: false,
        error: err instanceof Error ? err.message : "Không xóa được review",
      });
    }
  }

  return (
    <section className="surface-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Reviews</span>
          <h2>Đánh giá sau mua</h2>
        </div>
        <PackageCheck size={24} />
      </div>
      <div className="review-editor-list">
        {order.items.map((item) => {
          const draft = reviewDrafts[item.product_id] ?? buildReviewDraft(null);
          return (
            <article key={item.id} className="review-editor-card">
              <div className="review-editor-card__heading">
                <div>
                  <Link to={`/products/${item.product_id}`}>{item.name}</Link>
                  <p>{draft.existing ? "Đã có review" : "Chưa đánh giá"}</p>
                </div>
                {draft.existing ? (
                  <button
                    className="icon-button"
                    type="button"
                    disabled={draft.submitting}
                    onClick={() => void removeReview(item.product_id)}
                    aria-label="Xóa review"
                  >
                    <Trash2 size={17} />
                  </button>
                ) : null}
              </div>
              <div className="rating-control" aria-label="Chọn số sao">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    className={rating <= draft.rating ? "is-active" : ""}
                    onClick={() => updateReviewDraft(item.product_id, { rating })}
                    aria-label={`${rating} sao`}
                  >
                    <Star size={19} fill="currentColor" />
                  </button>
                ))}
              </div>
              <textarea
                value={draft.comment}
                rows={3}
                maxLength={2000}
                placeholder="Chia sẻ trải nghiệm sản phẩm"
                onChange={(event) =>
                  updateReviewDraft(item.product_id, { comment: event.target.value })
                }
              />
              {draft.error ? <p className="inline-error">{draft.error}</p> : null}
              {draft.status ? <p className="inline-success">{draft.status}</p> : null}
              <button
                className="button button--primary"
                type="button"
                disabled={draft.submitting}
                onClick={() => void saveReview(item.product_id)}
              >
                {draft.submitting
                  ? "Đang lưu"
                  : draft.existing
                    ? "Cập nhật review"
                    : "Gửi review"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
