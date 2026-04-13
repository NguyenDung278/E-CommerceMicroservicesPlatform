import type { FormEvent, ReactNode } from "react";

import { useProfileAvatarUpload } from "@/features/account/hooks/use-profile-avatar-upload";
import type { PhoneVerificationChallenge } from "@/types/api";
import {
  buildProfileInitials,
  formatPhoneForOtpLabel,
  getPhoneVerificationDescription,
  getPhoneVerificationStatusLabel,
  type ProfileFieldErrors,
  type ProfileFormState,
} from "../../utils/profile-editor";

type ProfileEditorFormProps = {
  canSubmit: boolean;
  form: ProfileFormState;
  formErrors: ProfileFieldErrors;
  formatCountdown: (seconds: number) => string;
  hasValidPhoneDraft: boolean;
  isOtpBusy: boolean;
  isSaving: boolean;
  otpExpiresIn: number;
  otpPanelVisible: boolean;
  otpResendIn: number;
  phoneChanged: boolean;
  phoneIsVerifiedForDraft: boolean;
  phoneVerification: PhoneVerificationChallenge | null;
  userPhoneVerified: boolean;
  verificationPendingForDraft: boolean;
  onClose: () => void;
  onFieldChange: (field: keyof ProfileFormState, value: string) => void;
  onPhoneChange: (value: string) => void;
  onResendPhoneOtp: () => void;
  onSendPhoneOtp: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onVerifyPhoneOtp: () => void;
};

export function ProfileEditorForm({
  canSubmit,
  form,
  formErrors,
  formatCountdown,
  hasValidPhoneDraft,
  isOtpBusy,
  isSaving,
  otpExpiresIn,
  otpPanelVisible,
  otpResendIn,
  phoneChanged,
  phoneIsVerifiedForDraft,
  phoneVerification,
  userPhoneVerified,
  verificationPendingForDraft,
  onClose,
  onFieldChange,
  onPhoneChange,
  onResendPhoneOtp,
  onSendPhoneOtp,
  onSubmit,
  onVerifyPhoneOtp,
}: ProfileEditorFormProps) {
  const {
    avatarError,
    avatarSuccess,
    displayedAvatarUrl,
    handleAvatarChange,
    isUploadingAvatar,
    retryAvatarUpload,
    selectedAvatarFile,
    clearSelectedAvatar,
  } = useProfileAvatarUpload();

  const avatarFallbackLabel = buildProfileInitials(`${form.firstName} ${form.lastName}`.trim());
  const otpPhoneLabel = formatPhoneForOtpLabel(phoneVerification?.phone || form.phone);
  const verificationDescription = getPhoneVerificationDescription({
    phoneChanged,
    phoneIsVerifiedForDraft,
    verificationPendingForDraft,
    userPhoneVerified,
  });
  const verificationStatusLabel = getPhoneVerificationStatusLabel({
    phoneChanged,
    phoneIsVerifiedForDraft,
    verificationPendingForDraft,
    userPhoneVerified,
  });
  const resendButtonLabel =
    otpResendIn > 0 ? `Resend OTP in ${formatCountdown(otpResendIn)}` : "Resend OTP";
  const attemptsLeftLabel =
    phoneVerification && phoneVerification.max_attempts > 0
      ? `${phoneVerification.remaining_attempts} of ${phoneVerification.max_attempts} attempts left`
      : "";

  return (
    <form className="profile-route-form" onSubmit={onSubmit}>
      <div className="profile-route-form-head">
        <div>
          <p className="profile-route-form-eyebrow">Profile studio</p>
          <h2>Edit Profile</h2>
          <p>
            Refine identity details, update the profile photo instantly, and secure phone changes
            before saving.
          </p>
        </div>

        <button className="ghost-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <section className="profile-route-form-section">
        <div className="profile-route-form-section-copy">
          <h3>Identity</h3>
          <p>These details appear across account, checkout, and order follow-up flows.</p>
        </div>

        <div className="profile-route-form-grid">
          <div className="profile-route-form-field profile-route-form-field-full">
            <span>Profile Avatar</span>
            <div className="profile-route-avatar-upload">
              <div className="profile-route-avatar-upload-preview">
                {displayedAvatarUrl ? (
                  <img
                    alt="Avatar preview"
                    className="profile-route-avatar-upload-image"
                    src={displayedAvatarUrl}
                  />
                ) : (
                  <span className="profile-route-avatar-upload-fallback">
                    {avatarFallbackLabel}
                  </span>
                )}
              </div>

              <div className="profile-route-avatar-upload-controls">
                <input
                  accept="image/*"
                  className="profile-route-avatar-upload-input"
                  disabled={isUploadingAvatar}
                  type="file"
                  onChange={handleAvatarChange}
                />

                <div className="profile-route-form-actions">
                  {selectedAvatarFile && avatarError && !isUploadingAvatar ? (
                    <button className="secondary-button" type="button" onClick={retryAvatarUpload}>
                      Retry Upload
                    </button>
                  ) : null}

                  {selectedAvatarFile && !isUploadingAvatar ? (
                    <button className="ghost-button" type="button" onClick={clearSelectedAvatar}>
                      Remove Selection
                    </button>
                  ) : null}
                </div>

                <small className="profile-route-form-hint">
                  Choose a JPG, PNG, WEBP, or GIF under 5MB. The preview switches instantly while
                  the upload is processed in the background.
                </small>

                {selectedAvatarFile ? (
                  <small className="profile-route-form-hint">
                    {isUploadingAvatar
                      ? `Uploading ${selectedAvatarFile.name}`
                      : `Selected image: ${selectedAvatarFile.name}`}
                  </small>
                ) : null}

                {avatarError ? (
                  <small className="profile-route-form-error">{avatarError}</small>
                ) : null}

                {!avatarError && avatarSuccess ? (
                  <small className="profile-route-avatar-upload-success">{avatarSuccess}</small>
                ) : null}
              </div>
            </div>
          </div>

          <ProfileField error={formErrors.firstName} label="First Name">
            <input
              placeholder="Enter your first name"
              value={form.firstName}
              onChange={(event) => onFieldChange("firstName", event.target.value)}
            />
          </ProfileField>

          <ProfileField error={formErrors.lastName} label="Last Name">
            <input
              placeholder="Enter your last name"
              value={form.lastName}
              onChange={(event) => onFieldChange("lastName", event.target.value)}
            />
          </ProfileField>

        </div>
      </section>

      <section className="profile-route-verification-panel">
        <div className="profile-route-form-head profile-route-form-head-inline">
          <div>
            <p className="profile-route-form-eyebrow">Secure access</p>
            <h2>Phone Verification</h2>
            <p>{verificationDescription}</p>
          </div>
        </div>

        <div className="profile-route-verification-summary">
          <span
            className={
              phoneIsVerifiedForDraft
                ? "profile-route-verification-status profile-route-verification-status-success"
                : verificationPendingForDraft
                  ? "profile-route-verification-status profile-route-verification-status-pending"
                  : "profile-route-verification-status"
            }
          >
            {verificationStatusLabel}
          </span>
          {attemptsLeftLabel ? (
            <span className="profile-route-verification-inline-note">{attemptsLeftLabel}</span>
          ) : null}
        </div>

        <div className="profile-route-verification-stats">
          {phoneVerification?.verification_id ? (
            <VerificationStat
              label="OTP expires"
              value={otpExpiresIn > 0 ? formatCountdown(otpExpiresIn) : "Expired"}
            />
          ) : null}
          {phoneVerification?.verification_id ? (
            <VerificationStat
              label="Resend"
              value={otpResendIn > 0 ? formatCountdown(otpResendIn) : "Ready"}
            />
          ) : null}
          <VerificationStat
            label="Delivery"
            value={
              phoneChanged
                ? "Telegram OTP"
                : userPhoneVerified
                  ? "Verified number"
                  : "Pending setup"
            }
          />
        </div>

        <div className="profile-route-mobile-verify-flow">
          <ProfileField
            className="profile-route-mobile-verify-field"
            error={formErrors.phone}
            label="Phone Number"
          >
            <div className="profile-route-phone-entry">
              <select
                aria-label="Country code"
                className="profile-route-country-code"
                defaultValue="+84"
              >
                <option value="+84">+84</option>
              </select>
              <input
                inputMode="numeric"
                placeholder="912 345 678"
                value={form.phone}
                onChange={(event) => onPhoneChange(event.target.value)}
              />
            </div>
          </ProfileField>

          <div className="profile-route-verification-actions">
            <button
              className={`primary-button profile-route-mobile-verify-button${!hasValidPhoneDraft ? " profile-route-phone-action-disabled" : ""}`}
              disabled={!hasValidPhoneDraft || isOtpBusy}
              type="button"
              onClick={onSendPhoneOtp}
            >
              {isOtpBusy && !otpPanelVisible
                ? "Sending..."
                : verificationPendingForDraft
                  ? "Send fresh OTP"
                  : "Send OTP"}
            </button>

            {otpPanelVisible && phoneVerification?.verification_id ? (
              <button
                className="ghost-button profile-route-mobile-verify-button profile-route-mobile-verify-button-secondary"
                disabled={isOtpBusy || otpResendIn > 0}
                type="button"
                onClick={onResendPhoneOtp}
              >
                {resendButtonLabel}
              </button>
            ) : null}
          </div>

          {verificationPendingForDraft ? (
            <div className="profile-route-verification-toast">
              OTP sent to {otpPhoneLabel}. Enter the 6-digit code below to continue.
            </div>
          ) : null}

          {otpPanelVisible ? (
            <div className="profile-route-mobile-otp-panel">
              <ProfileField
                className="profile-route-mobile-verify-field"
                error={formErrors.otpCode}
                label={`Enter the 6-digit code sent to ${otpPhoneLabel}`}
              >
                <input
                  className="profile-route-mobile-otp-input"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={form.otpCode}
                  onChange={(event) =>
                    onFieldChange("otpCode", event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </ProfileField>

              <button
                className="primary-button profile-route-mobile-verify-button"
                disabled={
                  isOtpBusy ||
                  !phoneVerification?.verification_id ||
                  form.otpCode.trim().length !== 6
                }
                type="button"
                onClick={onVerifyPhoneOtp}
              >
                {isOtpBusy ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          ) : null}
        </div>

        {phoneIsVerifiedForDraft && phoneChanged ? (
          <div className="profile-route-verification-note">
            The new phone number has been verified. Save the profile to apply it permanently.
          </div>
        ) : null}
      </section>

      <div className="profile-route-form-actions profile-route-form-actions-end">
        <small className="profile-route-form-hint">
          Changes are committed only after a successful save.
        </small>
        <button className="primary-button" disabled={!canSubmit} type="submit">
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

type ProfileFieldProps = {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

function ProfileField({ label, error, className, children }: ProfileFieldProps) {
  return (
    <label
      className={className ? `profile-route-form-field ${className}` : "profile-route-form-field"}
    >
      <span>{label}</span>
      {children}
      {error ? <small className="profile-route-form-error">{error}</small> : null}
    </label>
  );
}

type VerificationStatProps = {
  label: string;
  value: string;
};

function VerificationStat({ label, value }: VerificationStatProps) {
  return (
    <div className="profile-route-verification-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
