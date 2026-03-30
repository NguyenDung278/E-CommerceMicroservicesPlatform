import type { FormEvent } from "react";

import type { PhoneVerificationChallenge } from "../../../../shared/types/api";
import {
  getPhoneVerificationDescription,
  type ProfileFieldErrors,
  type ProfileFormState,
} from "../../utils/profileEditor";

type ProfileEditorFormProps = {
  canSubmit: boolean;
  form: ProfileFormState;
  formErrors: ProfileFieldErrors;
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
  hasValidPhoneDraft: boolean;
  formatCountdown: (seconds: number) => string;
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
  return (
    <form className="profile-route-form" onSubmit={onSubmit}>
      <div className="profile-route-form-head">
        <div>
          <h2>Edit Profile</h2>
          <p>Update your profile, delivery address, and verify any new phone number before saving.</p>
        </div>

        <button className="ghost-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="profile-route-form-grid">
        <label className="profile-route-form-field">
          <span>First Name</span>
          <input value={form.firstName} onChange={(event) => onFieldChange("firstName", event.target.value)} />
          {formErrors.firstName ? <small className="profile-route-form-error">{formErrors.firstName}</small> : null}
        </label>

        <label className="profile-route-form-field">
          <span>Last Name</span>
          <input value={form.lastName} onChange={(event) => onFieldChange("lastName", event.target.value)} />
          {formErrors.lastName ? <small className="profile-route-form-error">{formErrors.lastName}</small> : null}
        </label>

        <label className="profile-route-form-field">
          <span>Profile Phone</span>
          <div className="profile-route-phone-row">
            <input
              inputMode="numeric"
              value={form.phone}
              onChange={(event) => onPhoneChange(event.target.value)}
              placeholder="0912345678"
            />
            <button
              className={`primary-button profile-route-phone-action${!hasValidPhoneDraft ? " profile-route-phone-action-disabled" : ""}`}
              disabled={!hasValidPhoneDraft || isOtpBusy}
              type="button"
              onClick={onSendPhoneOtp}
            >
              {isOtpBusy ? "Sending..." : "Verification"}
            </button>
          </div>
          <small className="profile-route-form-hint">Enter a new 10-digit phone number to enable verification.</small>
          {formErrors.phone ? <small className="profile-route-form-error">{formErrors.phone}</small> : null}
        </label>

        <label className="profile-route-form-field">
          <span>Recipient Name</span>
          <input value={form.recipientName} onChange={(event) => onFieldChange("recipientName", event.target.value)} />
          {formErrors.recipientName ? <small className="profile-route-form-error">{formErrors.recipientName}</small> : null}
        </label>

        <label className="profile-route-form-field profile-route-form-field-full">
          <span>Street Address</span>
          <input value={form.street} onChange={(event) => onFieldChange("street", event.target.value)} />
          {formErrors.street ? <small className="profile-route-form-error">{formErrors.street}</small> : null}
        </label>

        <label className="profile-route-form-field">
          <span>Ward</span>
          <input value={form.ward} onChange={(event) => onFieldChange("ward", event.target.value)} />
        </label>

        <label className="profile-route-form-field">
          <span>District</span>
          <input value={form.district} onChange={(event) => onFieldChange("district", event.target.value)} />
          {formErrors.district ? <small className="profile-route-form-error">{formErrors.district}</small> : null}
        </label>

        <label className="profile-route-form-field">
          <span>City</span>
          <input value={form.city} onChange={(event) => onFieldChange("city", event.target.value)} />
          {formErrors.city ? <small className="profile-route-form-error">{formErrors.city}</small> : null}
        </label>
      </div>

      <div className="profile-route-verification-panel">
        <div className="profile-route-form-head profile-route-form-head-inline">
          <div>
            <h2>Phone Verification</h2>
            <p>
              {getPhoneVerificationDescription({
                phoneChanged,
                phoneIsVerifiedForDraft,
                verificationPendingForDraft,
                userPhoneVerified,
              })}
            </p>
          </div>
        </div>

        {otpPanelVisible ? (
          <div className="profile-route-form-grid">
            <label className="profile-route-form-field">
              <span>OTP Code</span>
              <input
                inputMode="numeric"
                value={form.otpCode}
                onChange={(event) => onFieldChange("otpCode", event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6 digits"
              />
              {formErrors.otpCode ? <small className="profile-route-form-error">{formErrors.otpCode}</small> : null}
            </label>

            <div className="profile-route-form-actions profile-route-form-actions-stacked">
              <button
                className="secondary-button"
                disabled={isOtpBusy || !phoneVerification?.verification_id || form.otpCode.trim().length !== 6}
                type="button"
                onClick={onVerifyPhoneOtp}
              >
                {isOtpBusy ? "Verifying..." : "Verify OTP"}
              </button>
              <button
                className="secondary-button"
                disabled={isOtpBusy || !phoneVerification?.verification_id || otpResendIn > 0}
                type="button"
                onClick={onResendPhoneOtp}
              >
                {otpResendIn > 0 ? `Resend in ${otpResendIn}s` : "Resend OTP"}
              </button>
            </div>
          </div>
        ) : null}

        {phoneVerification ? (
          <div className="profile-route-verification-meta">
            <p><strong>Masked phone:</strong> {phoneVerification.phone_masked}</p>
            <p><strong>Status:</strong> {phoneVerification.status === "verified" ? "verified - waiting for save" : phoneVerification.status}</p>
            <p><strong>Expires in:</strong> {formatCountdown(otpExpiresIn)}</p>
            <p><strong>Resend in:</strong> {formatCountdown(otpResendIn)}</p>
            <p><strong>Remaining attempts:</strong> {phoneVerification.remaining_attempts}</p>
          </div>
        ) : null}
      </div>

      <div className="profile-route-form-actions">
        <button className="primary-button" disabled={!canSubmit} type="submit">
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
