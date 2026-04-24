"use client";

import { useState, type FormEvent } from "react";

import { AccountShell } from "@/components/account-shared/account-shell";
import {
  InlineAlert,
  SurfaceCard,
  TextInput,
} from "@/components/storefront-shared/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { useOrderPayments } from "@/hooks/useOrderPayments";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { formatLongDate } from "@/utils/format";

import { getLatestPayment } from "@/components/account-shared/account-helpers";

export function SecurityPageView() {
  const { user, changePassword, resendVerificationEmail, token } = useAuth();
  const { orders, paymentsByOrder } = useOrderPayments(token);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(user?.phone_verified));

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
        <SurfaceCard className="p-6 md:p-8">
          <div>
            <p className="eyebrow">Password studio</p>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
              Change password
            </h2>
            <p className="mt-4 text-sm leading-7 text-on-surface-variant">
              Update your password directly inside the authenticated session without relying on the email recovery flow.
            </p>
          </div>
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

        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  Two-Factor Auth
                </h3>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                  Add an extra layer of security to your account.
                </p>
              </div>
              <button
                type="button"
                aria-pressed={twoFactorEnabled}
                className={
                  twoFactorEnabled
                    ? "inline-flex h-8 w-14 items-center rounded-full bg-primary px-1"
                    : "inline-flex h-8 w-14 items-center rounded-full bg-surface-container-high px-1"
                }
                onClick={() => setTwoFactorEnabled((current) => !current)}
              >
                <span
                  className={
                    twoFactorEnabled
                      ? "h-6 w-6 translate-x-6 rounded-full bg-white transition"
                      : "h-6 w-6 translate-x-0 rounded-full bg-primary transition"
                  }
                />
              </button>
            </div>

            <div className="mt-6 rounded-[1.25rem] bg-surface p-4">
              <p className="font-semibold text-primary">
                {twoFactorEnabled ? "SMS verification enabled" : "Two-factor auth is currently off"}
              </p>
              <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                {twoFactorEnabled
                  ? "Số điện thoại đã xác minh có thể được dùng như lớp bảo vệ bổ sung cho luồng đăng nhập và recovery."
                  : "Bật lại xác thực bổ sung sau khi bạn hoàn tất số điện thoại và các bước bảo mật cần thiết."}
              </p>
            </div>
          </SurfaceCard>

          <SurfaceCard className="bg-primary p-6 text-on-primary">
            <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-surface">
              {user?.email_verified ? "Account is secure" : "Verification needed"}
            </h3>
            <p className="mt-4 text-sm leading-7 text-on-primary/80">
              {user?.email_verified
                ? "Email phục hồi đã sẵn sàng cho các flow bảo vệ tài khoản và security notice."
                : "Xác minh email để tăng độ an toàn cho account recovery và các thông báo quan trọng."}
            </p>
            {!user?.email_verified ? (
              <button
                type="button"
                className={`${buttonStyles({ variant: "secondary" })} mt-6 w-full border-white/15 bg-white/10 text-white hover:bg-white/15`}
                disabled={busy}
                onClick={() => void handleResendVerification()}
              >
                Gửi lại email xác minh
              </button>
            ) : null}
          </SurfaceCard>
        </div>
      </div>

      <SurfaceCard className="p-6">
        <div>
          <p className="eyebrow">Recent activity</p>
          <h3 className="mt-4 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
            Security activity
          </h3>
        </div>
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
