import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { FormField } from "../ui/form/FormField";
import { OrderHistoryList } from "../ui/orders/OrderHistoryList";
import { useAuth } from "../hooks/useAuth";
import { useOrderPayments } from "../hooks/useOrderPayments";
import { getErrorMessage } from "../lib/api";
import { formatCurrency, formatDateTime } from "../utils/format";
import { sanitizeText } from "../utils/sanitize";
import { formatRoleLabel, getUserDisplayName, isDevelopmentAccount } from "../utils/devAccounts";
import { validateProfile } from "../utils/validation";
import "./ProfilePage.css";

export function ProfilePage() {
  const { token, user, updateProfile, resendVerificationEmail, canAccessAdmin } = useAuth();
  const [profileForm, setProfileForm] = useState({
    firstName: user?.first_name || "",
    lastName: user?.last_name || ""
  });
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const { orders, paymentsByOrder, isLoading, error: recordsError } = useOrderPayments(token);
  const paymentEntries = Object.values(paymentsByOrder).flat();
  const totalSpend = orders.reduce((sum, order) => sum + order.total_price, 0);
  const displayName = getUserDisplayName(user);
  const roleLabel = formatRoleLabel(user?.role);
  const isDevelopmentUser = isDevelopmentAccount(user);
  const profileMetrics = [
    {
      label: "Orders placed",
      value: `${orders.length}`,
      description: orders.length > 0 ? "Luồng order history đang hoạt động từ backend thật." : "Chưa có order nào được ghi nhận."
    },
    {
      label: "Recorded payments",
      value: `${paymentEntries.length}`,
      description:
        paymentEntries.length > 0 ? "Các payment record được tổng hợp từ payment service." : "Khi thanh toán thành công, chỉ số này sẽ tăng."
    },
    {
      label: "Lifetime spend",
      value: formatCurrency(totalSpend),
      description: "Tổng giá trị order hiện có của tài khoản này."
    }
  ];

  useEffect(() => {
    setProfileForm({
      firstName: user?.first_name || "",
      lastName: user?.last_name || ""
    });
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      first_name: sanitizeText(profileForm.firstName),
      last_name: sanitizeText(profileForm.lastName)
    };

    const errors = validateProfile({
      firstName: payload.first_name,
      lastName: payload.last_name
    });
    if (errors.length > 0) {
      setFeedback(errors.join(" "));
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile(payload);
      setFeedback("Đã cập nhật hồ sơ thành công.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResendVerification() {
    try {
      setIsResendingVerification(true);
      await resendVerificationEmail();
      setFeedback("Đã gửi lại email xác minh. Hãy kiểm tra hộp thư đến hoặc log SMTP giả lập.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsResendingVerification(false);
    }
  }

  return (
    <div className="page-stack profile-page">
      <section className="profile-hero">
        <div className="profile-hero-panel">
          <div className="profile-identity-block">
            <div className="profile-chip-row">
              <span className="eyebrow">Account Center</span>
              <span className="account-role">{roleLabel}</span>
              {isDevelopmentUser ? <span className="account-flag">DEV ONLY</span> : null}
              <span className={user?.email_verified ? "status-pill status-pill-success" : "status-pill status-pill-neutral"}>
                {user?.email_verified ? "Đã xác minh" : "Chưa xác minh"}
              </span>
            </div>

            <div className="profile-heading-block">
              <h1>{displayName}</h1>
              <p>
                Hồ sơ người dùng, lịch sử order và trạng thái thanh toán được gom về cùng một nơi để dễ theo dõi trong
                quá trình test hoặc demo hệ thống.
              </p>
            </div>

            <div className="profile-fact-grid">
              <article className="profile-fact-card">
                <span>Email</span>
                <strong>{user?.email || "Chưa có dữ liệu"}</strong>
              </article>
              <article className="profile-fact-card">
                <span>Điện thoại</span>
                <strong>{user?.phone || "Chưa cập nhật"}</strong>
              </article>
              <article className="profile-fact-card">
                <span>Member since</span>
                <strong>{user?.created_at ? formatDateTime(user.created_at) : "Đang đồng bộ"}</strong>
              </article>
              <article className="profile-fact-card">
                <span>Admin access</span>
                <strong>{canAccessAdmin ? "Có quyền vào admin console" : "Tài khoản storefront"}</strong>
              </article>
            </div>
          </div>
        </div>

        <aside className="profile-summary-panel">
          <div className="profile-summary-head">
            <span className="section-kicker">Snapshot</span>
            <h2>Tóm tắt tài khoản</h2>
          </div>

          <div className="profile-metric-grid">
            {profileMetrics.map((item) => (
              <article className="summary-card profile-metric-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>

          <div className="profile-summary-foot">
            <Link className="text-link" to="/payments">
              Xem lịch sử thanh toán
            </Link>
            {canAccessAdmin ? (
              <Link className="text-link" to="/admin">
                Mở admin console
              </Link>
            ) : null}
          </div>
        </aside>
      </section>

      <section className="content-section profile-workbench">
        <div className="section-heading profile-workbench-head">
          <div>
            <span className="section-kicker">Profile Workspace</span>
            <h2>Cập nhật hồ sơ và xem giao dịch gần đây</h2>
          </div>
          <span className="profile-workbench-caption">
            {orders[0]?.created_at ? `Order gần nhất: ${formatDateTime(orders[0].created_at)}` : "Chưa có order gần đây"}
          </span>
        </div>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}
        {recordsError ? <div className="feedback feedback-error">{recordsError}</div> : null}
        {user && !user.email_verified ? (
          <div className="feedback feedback-warning profile-warning-banner">
            <div className="profile-warning-copy">
              <strong>Email của bạn chưa được xác minh.</strong>
              <span>Một số luồng phục hồi tài khoản và thông báo sẽ phụ thuộc vào địa chỉ email này.</span>
            </div>
            <button
              className="ghost-button"
              disabled={isResendingVerification}
              type="button"
              onClick={() => void handleResendVerification()}
            >
              {isResendingVerification ? "Đang gửi lại..." : "Gửi lại email xác minh"}
            </button>
          </div>
        ) : null}

        <div className="profile-content-grid">
          <form className="card profile-editor-card" onSubmit={handleSubmit}>
            <div className="profile-card-head">
              <div>
                <span className="section-kicker">Edit Profile</span>
                <h2>Cập nhật thông tin hiển thị</h2>
              </div>
            </div>

            <div className="profile-summary">
              <span>Email: {user?.email}</span>
              <span>Email verified: {user?.email_verified ? "Đã xác minh" : "Chưa xác minh"}</span>
              <span>SĐT: {user?.phone || "Chưa cập nhật"}</span>
              <span>Role: {roleLabel}</span>
            </div>

            <div className="inline-grid">
              <FormField htmlFor="profile-first-name" label="Tên">
                <input
                  id="profile-first-name"
                  value={profileForm.firstName}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, firstName: event.target.value }))
                  }
                />
              </FormField>
              <FormField htmlFor="profile-last-name" label="Họ">
                <input
                  id="profile-last-name"
                  value={profileForm.lastName}
                  onChange={(event) =>
                    setProfileForm((current) => ({ ...current, lastName: event.target.value }))
                  }
                />
              </FormField>
            </div>

            <button className="primary-button" disabled={isSaving} type="submit">
              {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </form>

          <div className="card profile-history-card">
            <div className="profile-card-head">
              <div>
                <span className="section-kicker">Order History</span>
                <h2>Đơn hàng gần đây</h2>
              </div>
              <Link className="text-link" to="/products">
                Tiếp tục mua sắm
              </Link>
            </div>

            {isLoading ? (
              <div className="page-state">Đang tải lịch sử giao dịch...</div>
            ) : (
              <OrderHistoryList
                orders={orders}
                paymentsByOrder={paymentsByOrder}
                emptyDescription="Khi bạn đặt hàng thành công, danh sách đơn sẽ xuất hiện tại đây."
                emptyTitle="Bạn chưa có đơn hàng nào"
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
