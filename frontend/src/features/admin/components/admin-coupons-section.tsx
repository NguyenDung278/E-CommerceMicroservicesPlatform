import type { Dispatch, FormEvent, SetStateAction } from "react";

import { FormField } from "@/components/form/form-field";
import { formatCurrency, formatDateTime } from "@/utils/format";
import type { Coupon } from "@/types/api";
import type { CouponFormState } from "@/features/admin/utils/product-form";

type AdminCouponsSectionProps = {
  couponForm: CouponFormState;
  coupons: Coupon[];
  isCreatingCoupon: boolean;
  setCouponForm: Dispatch<SetStateAction<CouponFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AdminCouponsSection({
  couponForm,
  coupons,
  isCreatingCoupon,
  setCouponForm,
  onSubmit,
}: AdminCouponsSectionProps) {
  return (
    <div className="two-column-grid admin-console-workbench" id="admin-coupon-workbench">
      <form className="card admin-console-panel" onSubmit={onSubmit}>
        <h2>Tạo coupon mới</h2>

        <div className="inline-grid">
          <FormField htmlFor="admin-coupon-code" label="Mã coupon" required>
            <input
              id="admin-coupon-code"
              placeholder="SAVE10"
              value={couponForm.code}
              onChange={(event) =>
                setCouponForm((current) => ({
                  ...current,
                  code: event.target.value.toUpperCase(),
                }))
              }
            />
          </FormField>
          <FormField htmlFor="admin-coupon-type" label="Kiểu giảm giá">
            <select
              id="admin-coupon-type"
              value={couponForm.discountType}
              onChange={(event) =>
                setCouponForm((current) => ({
                  ...current,
                  discountType: event.target.value as CouponFormState["discountType"],
                }))
              }
            >
              <option value="percentage">Theo phần trăm</option>
              <option value="fixed">Số tiền cố định</option>
            </select>
          </FormField>
        </div>

        <FormField
          htmlFor="admin-coupon-description"
          hint="Mô tả ngắn sẽ hiển thị trong phần ưu đãi của khách hàng."
          label="Mô tả"
        >
          <input
            id="admin-coupon-description"
            placeholder="Giảm 10% cho đơn từ $50"
            value={couponForm.description}
            onChange={(event) =>
              setCouponForm((current) => ({ ...current, description: event.target.value }))
            }
          />
        </FormField>

        <div className="inline-grid">
          <FormField htmlFor="admin-coupon-discount" label="Giá trị giảm" required>
            <input
              id="admin-coupon-discount"
              min="0"
              step="0.01"
              type="number"
              value={couponForm.discountValue}
              onChange={(event) =>
                setCouponForm((current) => ({
                  ...current,
                  discountValue: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField htmlFor="admin-coupon-min-order" label="Đơn tối thiểu">
            <input
              id="admin-coupon-min-order"
              min="0"
              step="0.01"
              type="number"
              value={couponForm.minOrderAmount}
              onChange={(event) =>
                setCouponForm((current) => ({
                  ...current,
                  minOrderAmount: event.target.value,
                }))
              }
            />
          </FormField>
        </div>

        <div className="inline-grid">
          <FormField htmlFor="admin-coupon-usage-limit" label="Giới hạn sử dụng">
            <input
              id="admin-coupon-usage-limit"
              min="0"
              step="1"
              type="number"
              value={couponForm.usageLimit}
              onChange={(event) =>
                setCouponForm((current) => ({ ...current, usageLimit: event.target.value }))
              }
            />
          </FormField>
          <FormField htmlFor="admin-coupon-expiry" label="Hết hạn">
            <input
              id="admin-coupon-expiry"
              type="datetime-local"
              value={couponForm.expiresAt}
              onChange={(event) =>
                setCouponForm((current) => ({ ...current, expiresAt: event.target.value }))
              }
            />
          </FormField>
        </div>

        <label className="checkbox-field" htmlFor="admin-coupon-active">
          <input
            checked={couponForm.active}
            id="admin-coupon-active"
            type="checkbox"
            onChange={(event) =>
              setCouponForm((current) => ({ ...current, active: event.target.checked }))
            }
          />
          <span>Kích hoạt coupon ngay sau khi tạo</span>
        </label>

        <button className="primary-button" disabled={isCreatingCoupon} type="submit">
          {isCreatingCoupon ? "Đang tạo coupon..." : "Tạo coupon"}
        </button>
      </form>

      <div className="card admin-console-panel">
        <div className="section-heading">
          <div>
            <h2>Danh sách coupon</h2>
            <p className="history-subtle">
              Keep a close eye on active offers, order thresholds, and remaining usage.
            </p>
          </div>
        </div>

        <div className="history-grid">
          {coupons.map((coupon) => (
            <article className="history-card admin-console-record" key={coupon.id}>
              <div className="history-card-head">
                <div>
                  <h3>{coupon.code}</h3>
                  <p className="history-subtle">
                    {coupon.description || "Offer details will appear here once a note is added."}
                  </p>
                </div>
                <span
                  className={
                    coupon.active
                      ? "status-pill status-pill-success"
                      : "status-pill status-pill-neutral"
                  }
                >
                  {coupon.active ? "Đang bật" : "Tạm tắt"}
                </span>
              </div>

              <div className="history-meta-grid">
                <div>
                  <span>Ưu đãi</span>
                  <strong>
                    {coupon.discount_type === "percentage"
                      ? `${coupon.discount_value}%`
                      : formatCurrency(coupon.discount_value)}
                  </strong>
                </div>
                <div>
                  <span>Đơn tối thiểu</span>
                  <strong>{formatCurrency(coupon.min_order_amount)}</strong>
                </div>
                <div>
                  <span>Đã dùng</span>
                  <strong>
                    {coupon.used_count}
                    {coupon.usage_limit > 0 ? ` / ${coupon.usage_limit}` : " / không giới hạn"}
                  </strong>
                </div>
                <div>
                  <span>Hết hạn</span>
                  <strong>
                    {coupon.expires_at ? formatDateTime(coupon.expires_at) : "Không giới hạn"}
                  </strong>
                </div>
              </div>
            </article>
          ))}

          {coupons.length === 0 ? (
            <p className="history-empty">
              Chưa có coupon nào. Bạn có thể tạo coupon đầu tiên ở khung bên trái.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
