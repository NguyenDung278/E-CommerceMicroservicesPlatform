import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { FormField } from "../components/FormField";
import { OrderHistoryList } from "../components/OrderHistoryList";
import { useAuth } from "../hooks/useAuth";
import { useOrderPayments } from "../hooks/useOrderPayments";
import { getErrorMessage } from "../lib/api";
import { sanitizeText } from "../utils/sanitize";
import { validateProfile } from "../utils/validation";

export function ProfilePage() {
  const { token, user, updateProfile } = useAuth();
  const [profileForm, setProfileForm] = useState({
    firstName: user?.first_name || "",
    lastName: user?.last_name || ""
  });
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { orders, paymentsByOrder, isLoading, error: recordsError } = useOrderPayments(token);

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

  return (
    <div className="page-stack">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Tài khoản</span>
            <h1>Thông tin cá nhân và lịch sử mua hàng</h1>
          </div>
          <Link className="text-link" to="/payments">
            Xem lịch sử thanh toán
          </Link>
        </div>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}
        {recordsError ? <div className="feedback feedback-error">{recordsError}</div> : null}

        <div className="two-column-grid">
          <form className="card" onSubmit={handleSubmit}>
            <h2>Cập nhật hồ sơ</h2>
            <div className="profile-summary">
              <span>Email: {user?.email}</span>
              <span>Role: {user?.role}</span>
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

          <div className="card">
            <h2>Đơn hàng gần đây</h2>
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
