import { Camera, MailCheck, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  getEmailVerificationStatus,
  getPhoneVerificationStatus,
  resendEmailVerificationOTP,
  resendPhoneVerificationOTP,
  sendEmailVerificationOTP,
  sendPhoneVerificationOTP,
  updateProfile,
  uploadAvatar,
  verifyEmailVerificationOTP,
  verifyPhoneVerificationOTP,
} from "../../services/user-service";
import { useAuth } from "../../state/auth-context";
import type { EmailVerificationStatus, PhoneVerificationStatus } from "../../types/api";
import { getInitials, phoneVerificationLabel } from "./account-helpers";

/**
 * Hồ sơ mua hàng: form họ tên + avatar, xác thực email bằng OTP và đổi số
 * điện thoại qua OTP Telegram (phone mới chỉ được lưu sau khi challenge
 * `verified` — xem FRONTEND_GUIDELINES.md, mục capability).
 */
export function ProfileSection() {
  const { token, user, refreshProfile } = useAuth();
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [emailVerification, setEmailVerification] = useState<EmailVerificationStatus | null>(null);
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationStatus | null>(null);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false);
  const [emailOtpResending, setEmailOtpResending] = useState(false);
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  const [phoneOtpVerifying, setPhoneOtpVerifying] = useState(false);
  const [phoneOtpResending, setPhoneOtpResending] = useState(false);

  const requestedProfilePhone = profileForm.phone.trim();
  const currentProfilePhone = user?.phone?.trim() ?? "";
  const profilePhoneChanged = requestedProfilePhone !== currentProfilePhone;
  const verifiedPhoneMatchesProfile =
    phoneVerification?.status === "verified" && phoneVerification.phone === requestedProfilePhone;
  const canResendPhoneOtp =
    Boolean(phoneVerification?.verification_id) &&
    phoneVerification?.status === "pending" &&
    (phoneVerification.resend_in_seconds ?? 0) <= 0;
  const canResendEmailOtp =
    Boolean(emailVerification?.verification_id) &&
    emailVerification?.status === "pending" &&
    (emailVerification.resend_in_seconds ?? 0) <= 0;

  useEffect(() => {
    if (!user) {
      return;
    }

    setProfileForm({
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      phone: user.phone ?? "",
    });
  }, [user]);

  useEffect(() => {
    let active = true;

    async function loadEmailVerification() {
      if (!token || user?.email_verified) {
        setEmailVerification(null);
        setEmailOtp("");
        return;
      }

      const status = await getEmailVerificationStatus(token).catch(() => null);
      if (active) {
        setEmailVerification(status);
      }
    }

    void loadEmailVerification();

    return () => {
      active = false;
    };
  }, [token, user?.email_verified]);

  useEffect(() => {
    let active = true;

    async function loadPhoneVerification() {
      if (!token) {
        setPhoneVerification(null);
        setPhoneOtp("");
        return;
      }

      const status = await getPhoneVerificationStatus(token).catch(() => null);
      if (active) {
        setPhoneVerification(status);
      }
    }

    void loadPhoneVerification();

    return () => {
      active = false;
    };
  }, [token]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    if (profilePhoneChanged) {
      if (!requestedProfilePhone) {
        setProfileStatus("Số điện thoại không được để trống khi cập nhật.");
        return;
      }
      if (!verifiedPhoneMatchesProfile) {
        setProfileStatus("Vui lòng xác thực số điện thoại bằng OTP Telegram trước khi lưu.");
        return;
      }
    }

    try {
      setProfileSubmitting(true);
      setProfileStatus(null);
      await updateProfile(token, {
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        ...(profilePhoneChanged
          ? {
              phone: requestedProfilePhone,
              phone_verification_id: phoneVerification?.verification_id,
            }
          : {}),
      });
      await refreshProfile();
      if (profilePhoneChanged) {
        setPhoneVerification(null);
      }
      setProfileStatus("Đã cập nhật hồ sơ");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không cập nhật được hồ sơ");
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function handleSendEmailOtp() {
    if (!token) {
      return;
    }

    try {
      setEmailOtpSending(true);
      setProfileStatus(null);
      setEmailOtp("");
      const status = await sendEmailVerificationOTP(token);
      setEmailVerification(status);
      setProfileStatus("Đã gửi OTP đến email. Nhập mã để xác thực.");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không gửi được OTP email");
    } finally {
      setEmailOtpSending(false);
    }
  }

  async function handleVerifyEmailOtp() {
    if (!token || !emailVerification?.verification_id) {
      return;
    }

    try {
      setEmailOtpVerifying(true);
      setProfileStatus(null);
      const status = await verifyEmailVerificationOTP(
        token,
        emailVerification.verification_id,
        emailOtp.trim(),
      );
      setEmailVerification(status);
      setEmailOtp("");
      await refreshProfile();
      setProfileStatus("Email đã được xác thực.");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "OTP email không hợp lệ");
    } finally {
      setEmailOtpVerifying(false);
    }
  }

  async function handleResendEmailOtp() {
    if (!token || !emailVerification?.verification_id) {
      return;
    }

    try {
      setEmailOtpResending(true);
      setProfileStatus(null);
      const status = await resendEmailVerificationOTP(token, emailVerification.verification_id);
      setEmailVerification(status);
      setEmailOtp("");
      setProfileStatus("Đã gửi lại OTP email.");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không gửi lại được OTP email");
    } finally {
      setEmailOtpResending(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!token || !file) {
      return;
    }

    try {
      setAvatarUploading(true);
      setProfileStatus(null);
      await uploadAvatar(token, file);
      await refreshProfile();
      setProfileStatus("Đã cập nhật ảnh đại diện");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không tải được ảnh đại diện");
    } finally {
      setAvatarUploading(false);
      event.target.value = "";
    }
  }

  async function handleSendPhoneOtp() {
    if (!token) {
      return;
    }
    if (!requestedProfilePhone) {
      setProfileStatus("Nhập số điện thoại trước khi gửi OTP.");
      return;
    }

    try {
      setPhoneOtpSending(true);
      setProfileStatus(null);
      setPhoneOtp("");
      const status = await sendPhoneVerificationOTP(token, requestedProfilePhone);
      setPhoneVerification(status);
      setProfileForm((current) => ({ ...current, phone: status.phone || requestedProfilePhone }));
      setProfileStatus("Đã gửi OTP qua Telegram. Nhập mã để xác thực số điện thoại.");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không gửi được OTP Telegram");
    } finally {
      setPhoneOtpSending(false);
    }
  }

  async function handleVerifyPhoneOtp() {
    if (!token || !phoneVerification?.verification_id) {
      return;
    }

    try {
      setPhoneOtpVerifying(true);
      setProfileStatus(null);
      const status = await verifyPhoneVerificationOTP(
        token,
        phoneVerification.verification_id,
        phoneOtp.trim(),
      );
      setPhoneVerification(status);
      setPhoneOtp("");
      if (status.status === "verified") {
        setProfileForm((current) => ({ ...current, phone: status.phone }));
        setProfileStatus("Số điện thoại đã xác thực. Bấm Lưu hồ sơ để cập nhật.");
      }
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "OTP không hợp lệ");
    } finally {
      setPhoneOtpVerifying(false);
    }
  }

  async function handleResendPhoneOtp() {
    if (!token || !phoneVerification?.verification_id) {
      return;
    }

    try {
      setPhoneOtpResending(true);
      setProfileStatus(null);
      const status = await resendPhoneVerificationOTP(token, phoneVerification.verification_id);
      setPhoneVerification(status);
      setPhoneOtp("");
      setProfileStatus("Đã gửi lại OTP qua Telegram.");
    } catch (err) {
      setProfileStatus(err instanceof Error ? err.message : "Không gửi lại được OTP Telegram");
    } finally {
      setPhoneOtpResending(false);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <section className="surface-section" id="profile">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Profile</span>
          <h2>Hồ sơ mua hàng</h2>
        </div>
        <ShieldCheck size={24} />
      </div>
      <div className="profile-layout">
        <aside className="avatar-upload-card">
          <div className="account-avatar account-avatar--large">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.first_name || user.email} />
            ) : (
              <span>{getInitials(user.first_name, user.email)}</span>
            )}
          </div>
          <div>
            <strong>Ảnh đại diện</strong>
            <p>JPG, PNG hoặc WebP tối đa 5MB.</p>
          </div>
          <label className="button button--secondary avatar-upload-button">
            <Camera size={16} />
            {avatarUploading ? "Đang tải" : "Đổi ảnh"}
            <input
              type="file"
              accept="image/*"
              disabled={avatarUploading}
              onChange={handleAvatarChange}
            />
          </label>
        </aside>

        <form className="profile-form" onSubmit={handleProfileSubmit}>
          <div className="form-grid">
            <label>
              Tên
              <input
                value={profileForm.first_name}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    first_name: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Họ
              <input
                value={profileForm.last_name}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    last_name: event.target.value,
                  }))
                }
                required
              />
            </label>
          </div>

          <div className="profile-verification-card">
            <div className="phone-verification-status">
              <MailCheck size={18} />
              <span className={user.email_verified ? "status-pill is-good" : "status-pill"}>
                Email{" "}
                {user.email_verified
                  ? "đã xác thực"
                  : phoneVerificationLabel(emailVerification?.status)}
              </span>
              {emailVerification?.email_masked ? <span>{emailVerification.email_masked}</span> : null}
              {emailVerification?.status === "pending" ? (
                <>
                  <span>Còn {Math.ceil(emailVerification.expires_in_seconds / 60)} phút</span>
                  <span>{emailVerification.remaining_attempts} lần nhập còn lại</span>
                </>
              ) : null}
            </div>

            {!user.email_verified ? (
              <>
                <div className="inline-actions">
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={emailOtpSending}
                    onClick={() => void handleSendEmailOtp()}
                  >
                    <Send size={16} />
                    {emailOtpSending ? "Đang gửi" : "Gửi OTP email"}
                  </button>
                  {emailVerification?.verification_id ? (
                    <button
                      className="button button--ghost"
                      type="button"
                      disabled={!canResendEmailOtp || emailOtpResending}
                      onClick={() => void handleResendEmailOtp()}
                    >
                      <RefreshCw size={16} />
                      {emailOtpResending
                        ? "Đang gửi lại"
                        : emailVerification.resend_in_seconds > 0
                          ? `Gửi lại (${emailVerification.resend_in_seconds}s)`
                          : "Gửi lại"}
                    </button>
                  ) : null}
                </div>

                {emailVerification?.verification_id && emailVerification.status !== "verified" ? (
                  <div className="otp-row">
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      value={emailOtp}
                      onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, ""))}
                      placeholder="Mã OTP"
                    />
                    <button
                      className="button button--primary"
                      type="button"
                      disabled={emailOtp.trim().length !== 6 || emailOtpVerifying}
                      onClick={() => void handleVerifyEmailOtp()}
                    >
                      {emailOtpVerifying ? "Đang xác thực" : "Xác thực"}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <label>
            Số điện thoại
            <input
              inputMode="tel"
              value={profileForm.phone}
              onChange={(event) => {
                const nextPhone = event.target.value;
                setProfileForm((current) => ({ ...current, phone: nextPhone }));
                setPhoneVerification((current) =>
                  current?.phone === nextPhone.trim() ? current : null,
                );
              }}
              placeholder="0987654321"
            />
          </label>

          <div className="profile-verification-card">
            <div className="phone-verification-status">
              <span
                className={
                  verifiedPhoneMatchesProfile || (!profilePhoneChanged && user.phone_verified)
                    ? "status-pill is-good"
                    : "status-pill"
                }
              >
                {profilePhoneChanged
                  ? phoneVerificationLabel(phoneVerification?.status)
                  : user.phone_verified
                    ? "SĐT đã xác thực"
                    : "SĐT chưa xác thực"}
              </span>
              {phoneVerification?.phone_masked ? (
                <span>{phoneVerification.phone_masked}</span>
              ) : null}
              {phoneVerification?.status === "pending" ? (
                <>
                  <span>Còn {Math.ceil(phoneVerification.expires_in_seconds / 60)} phút</span>
                  <span>{phoneVerification.remaining_attempts} lần nhập còn lại</span>
                </>
              ) : null}
            </div>

            <div className="inline-actions">
              <button
                className="button button--secondary"
                type="button"
                disabled={!requestedProfilePhone || phoneOtpSending}
                onClick={() => void handleSendPhoneOtp()}
              >
                <Send size={16} />
                {phoneOtpSending ? "Đang gửi" : "Gửi OTP Telegram"}
              </button>
              {phoneVerification?.verification_id ? (
                <button
                  className="button button--ghost"
                  type="button"
                  disabled={!canResendPhoneOtp || phoneOtpResending}
                  onClick={() => void handleResendPhoneOtp()}
                >
                  <RefreshCw size={16} />
                  {phoneOtpResending
                    ? "Đang gửi lại"
                    : phoneVerification.resend_in_seconds > 0
                      ? `Gửi lại (${phoneVerification.resend_in_seconds}s)`
                      : "Gửi lại"}
                </button>
              ) : null}
            </div>

            {phoneVerification?.verification_id && phoneVerification.status !== "verified" ? (
              <div className="otp-row">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={phoneOtp}
                  onChange={(event) => setPhoneOtp(event.target.value.replace(/\D/g, ""))}
                  placeholder="Mã OTP"
                />
                <button
                  className="button button--primary"
                  type="button"
                  disabled={phoneOtp.trim().length !== 6 || phoneOtpVerifying}
                  onClick={() => void handleVerifyPhoneOtp()}
                >
                  {phoneOtpVerifying ? "Đang xác thực" : "Xác thực"}
                </button>
              </div>
            ) : null}

            {verifiedPhoneMatchesProfile && profilePhoneChanged ? (
              <p className="inline-success">OTP hợp lệ, sẵn sàng lưu số mới.</p>
            ) : null}
          </div>

          {profileStatus ? <p className="muted-text">{profileStatus}</p> : null}
          <button className="button button--secondary" type="submit" disabled={profileSubmitting}>
            {profileSubmitting ? "Đang lưu" : "Lưu hồ sơ"}
          </button>
        </form>
      </div>
    </section>
  );
}
