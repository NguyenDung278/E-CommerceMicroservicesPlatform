"use client";

import { useState, type FormEvent } from "react";

import { AccountShell } from "@/components/account-shell";
import { InlineAlert, SurfaceCard, TextInput } from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { useOrderPayments } from "@/hooks/useOrderPayments";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { formatLongDate } from "@/utils/format";

import { getLatestPayment } from "./shared";

export function SecurityPageView() {
  const { user, changePassword, resendVerificationEmail, token } = useAuth();
  const { orders, paymentsByOrder } = useOrderPayments(token);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const latestPayment = getLatestPayment(paymentsByOrder);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setFeedback("Mật khẩu mới cần tối thiểu 8 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    try {
      setBusy(true);
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback("Mật khẩu đã được cập nhật.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendVerification() {
    try {
      setBusy(true);
      await resendVerificationEmail();
      setFeedback("Email xác minh mới đã được gửi.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell
      title="Bảo mật tài khoản"
      description="Đổi mật khẩu bằng API thật của user-service và theo dõi các tín hiệu hoạt động gần nhất của tài khoản."
    >
      {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SurfaceCard className="p-6">
          <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
            Đổi mật khẩu
          </h2>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <TextInput
              autoComplete="current-password"
              placeholder="Mật khẩu hiện tại"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <TextInput
              autoComplete="new-password"
              placeholder="Mật khẩu mới"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <TextInput
              autoComplete="new-password"
              placeholder="Xác nhận mật khẩu mới"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <button
              type="submit"
              className={`${buttonStyles({ size: "lg" })} w-full`}
              disabled={busy}
            >
              {busy ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
            </button>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
            Xác minh email
          </h3>
          <p className="mt-4 text-sm leading-7 text-on-surface-variant">
            {user?.email_verified
              ? "Email đã được xác minh."
              : "Email chưa được xác minh. Hãy gửi lại email xác minh để tăng độ an toàn của tài khoản."}
          </p>
          {!user?.email_verified ? (
            <button
              type="button"
              className={`${buttonStyles({ variant: "secondary" })} mt-6 w-full`}
              disabled={busy}
              onClick={() => void handleResendVerification()}
            >
              Gửi lại email xác minh
            </button>
          ) : null}
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-6">
        <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
          Hoạt động gần đây
        </h3>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.25rem] bg-surface p-4">
            <p className="font-semibold text-primary">Email tài khoản</p>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">{user?.email}</p>
          </div>
          <div className="rounded-[1.25rem] bg-surface p-4">
            <p className="font-semibold text-primary">Đơn hàng gần nhất</p>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">
              {orders[0] ? formatLongDate(orders[0].updated_at) : "Chưa có dữ liệu"}
            </p>
          </div>
          <div className="rounded-[1.25rem] bg-surface p-4">
            <p className="font-semibold text-primary">Thanh toán gần nhất</p>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">
              {latestPayment ? formatLongDate(latestPayment.created_at) : "Chưa có dữ liệu"}
            </p>
          </div>
        </div>
      </SurfaceCard>
    </AccountShell>
  );
}
