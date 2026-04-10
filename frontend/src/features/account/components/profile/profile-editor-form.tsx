import { useEffect, useState, type CSSProperties, type ChangeEvent, type FormEvent } from "react";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getErrorMessage } from "@/services/api";
import { userApi } from "@/services/api/modules/user-api";
import type { PhoneVerificationChallenge } from "@/types/api";
import {
  buildProfileInitials,
  getPhoneVerificationDescription,
  type ProfileFieldErrors,
  type ProfileFormState,
} from "../../utils/profile-editor";

const MAX_AVATAR_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const avatarUploadLayoutStyle: CSSProperties = {
  display: "flex",
  gap: "18px",
  alignItems: "center",
  flexWrap: "wrap",
};

const avatarPreviewShellStyle: CSSProperties = {
  width: "104px",
  height: "104px",
  borderRadius: "999px",
  overflow: "hidden",
  flexShrink: 0,
  border: "1px solid var(--profile-outline-strong)",
  background: "rgba(247, 242, 235, 0.92)",
  display: "grid",
  placeItems: "center",
};

const avatarPreviewImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const avatarFallbackStyle: CSSProperties = {
  color: "rgba(14, 29, 19, 0.48)",
  fontSize: "1.75rem",
  fontWeight: 700,
  letterSpacing: "-0.08em",
};

const avatarUploadControlsStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
  flex: "1 1 260px",
};

const avatarFileInputStyle: CSSProperties = {
  width: "100%",
  minHeight: "auto",
  padding: "14px 16px",
  border: "1px dashed var(--profile-outline-strong)",
  borderRadius: "18px",
  background: "rgba(255, 255, 255, 0.76)",
  cursor: "pointer",
};

const avatarSuccessStyle: CSSProperties = {
  color: "var(--color-success, #2e7d32)",
  fontSize: "0.88rem",
  lineHeight: 1.5,
};

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
  const { refreshProfile, token, user } = useAuth();
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const avatarFallbackLabel = buildProfileInitials(`${form.firstName} ${form.lastName}`.trim());
  const displayedAvatarUrl = avatarPreviewUrl || avatarUrl;

  // Keep the saved avatar in sync with auth context after profile refreshes.
  useEffect(() => {
    if (!selectedAvatarFile) {
      setAvatarUrl(user?.avatar_url || "");
    }
  }, [selectedAvatarFile, user?.avatar_url]);

  // Object URLs let us preview the local image before it is sent to the API.
  useEffect(() => {
    if (!selectedAvatarFile) {
      setAvatarPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedAvatarFile);
    setAvatarPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedAvatarFile]);

  function resetAvatarFeedback() {
    setAvatarError("");
    setAvatarSuccess("");
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    resetAvatarFeedback();

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setSelectedAvatarFile(null);
      setAvatarError("Please choose a valid image file.");
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      setSelectedAvatarFile(null);
      setAvatarError("Avatar image must be smaller than 5MB.");
      return;
    }

    setSelectedAvatarFile(file);
  }

  function handleClearSelectedAvatar() {
    setSelectedAvatarFile(null);
    resetAvatarFeedback();
  }

  // Upload stays separate so the existing profile-save flow keeps working as-is.
  async function handleAvatarUpload() {
    if (!selectedAvatarFile) {
      setAvatarError("Choose an image before uploading.");
      return;
    }

    if (!token) {
      setAvatarError("Your session has expired. Please sign in again.");
      return;
    }

    try {
      setIsUploadingAvatar(true);
      resetAvatarFeedback();

      const response = await userApi.uploadAvatar(token, selectedAvatarFile);
      let refreshedProfile = null;

      try {
        refreshedProfile = await refreshProfile();
      } catch {
        refreshedProfile = null;
      }

      const nextAvatarUrl =
        refreshedProfile?.avatar_url ||
        response.data.user?.avatar_url ||
        response.data.avatar_url ||
        "";

      if (nextAvatarUrl) {
        setAvatarUrl(nextAvatarUrl);
      }

      setSelectedAvatarFile(null);
      setAvatarSuccess("Avatar uploaded successfully.");
    } catch (reason) {
      setAvatarError(getErrorMessage(reason));
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <form className="profile-route-form" onSubmit={onSubmit}>
      <div className="profile-route-form-head">
        <div>
          <h2>Edit Profile</h2>
        </div>

        <button className="ghost-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="profile-route-form-grid">
        <div className="profile-route-form-field profile-route-form-field-full">
          <span>Profile Avatar</span>
          <div style={avatarUploadLayoutStyle}>
            <div style={avatarPreviewShellStyle}>
              {displayedAvatarUrl ? (
                <img alt="Avatar preview" src={displayedAvatarUrl} style={avatarPreviewImageStyle} />
              ) : (
                <span style={avatarFallbackStyle}>{avatarFallbackLabel}</span>
              )}
            </div>

            <div style={avatarUploadControlsStyle}>
              <input
                accept="image/*"
                style={avatarFileInputStyle}
                type="file"
                onChange={handleAvatarChange}
              />

              <div className="profile-route-form-actions">
                <button
                  className="secondary-button"
                  disabled={!selectedAvatarFile || isUploadingAvatar}
                  type="button"
                  onClick={() => void handleAvatarUpload()}
                >
                  {isUploadingAvatar ? "Uploading..." : "Upload Avatar"}
                </button>

                {selectedAvatarFile ? (
                  <button
                    className="ghost-button"
                    disabled={isUploadingAvatar}
                    type="button"
                    onClick={handleClearSelectedAvatar}
                  >
                    Remove Selection
                  </button>
                ) : null}
              </div>

              <small className="profile-route-form-hint">
                Choose a JPG, PNG, WEBP, or GIF under 5MB. A preview appears before upload.
              </small>

              {selectedAvatarFile ? (
                <small className="profile-route-form-hint">
                  Ready to upload: {selectedAvatarFile.name}
                </small>
              ) : null}

              {avatarError ? (
                <small className="profile-route-form-error">{avatarError}</small>
              ) : null}

              {!avatarError && avatarSuccess ? (
                <small style={avatarSuccessStyle}>{avatarSuccess}</small>
              ) : null}
            </div>
          </div>
        </div>

        <label className="profile-route-form-field">
          <span>First Name</span>
          <input
            value={form.firstName}
            onChange={(event) => onFieldChange("firstName", event.target.value)}
          />
          {formErrors.firstName ? (
            <small className="profile-route-form-error">{formErrors.firstName}</small>
          ) : null}
        </label>

        <label className="profile-route-form-field">
          <span>Last Name</span>
          <input
            value={form.lastName}
            onChange={(event) => onFieldChange("lastName", event.target.value)}
          />
          {formErrors.lastName ? (
            <small className="profile-route-form-error">{formErrors.lastName}</small>
          ) : null}
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
          <small className="profile-route-form-hint">
            Enter a new 10-digit phone number to enable verification.
          </small>
          {formErrors.phone ? (
            <small className="profile-route-form-error">{formErrors.phone}</small>
          ) : null}
        </label>

        <label className="profile-route-form-field">
          <span>Recipient Name</span>
          <input
            value={form.recipientName}
            onChange={(event) => onFieldChange("recipientName", event.target.value)}
          />
          {formErrors.recipientName ? (
            <small className="profile-route-form-error">{formErrors.recipientName}</small>
          ) : null}
        </label>

        <label className="profile-route-form-field profile-route-form-field-full">
          <span>Street Address</span>
          <input
            value={form.street}
            onChange={(event) => onFieldChange("street", event.target.value)}
          />
          {formErrors.street ? (
            <small className="profile-route-form-error">{formErrors.street}</small>
          ) : null}
        </label>

        <label className="profile-route-form-field">
          <span>Ward</span>
          <input
            value={form.ward}
            onChange={(event) => onFieldChange("ward", event.target.value)}
          />
        </label>

        <label className="profile-route-form-field">
          <span>District</span>
          <input
            value={form.district}
            onChange={(event) => onFieldChange("district", event.target.value)}
          />
          {formErrors.district ? (
            <small className="profile-route-form-error">{formErrors.district}</small>
          ) : null}
        </label>

        <label className="profile-route-form-field">
          <span>City</span>
          <input
            value={form.city}
            onChange={(event) => onFieldChange("city", event.target.value)}
          />
          {formErrors.city ? (
            <small className="profile-route-form-error">{formErrors.city}</small>
          ) : null}
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
                onChange={(event) =>
                  onFieldChange("otpCode", event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6 digits"
              />
              {formErrors.otpCode ? (
                <small className="profile-route-form-error">{formErrors.otpCode}</small>
              ) : null}
            </label>

            <div className="profile-route-form-actions profile-route-form-actions-stacked">
              <button
                className="secondary-button"
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
            <p>
              <strong>Masked phone:</strong> {phoneVerification.phone_masked}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              {phoneVerification.status === "verified"
                ? "verified - waiting for save"
                : phoneVerification.status}
            </p>
            <p>
              <strong>Expires in:</strong> {formatCountdown(otpExpiresIn)}
            </p>
            <p>
              <strong>Resend in:</strong> {formatCountdown(otpResendIn)}
            </p>
            <p>
              <strong>Remaining attempts:</strong> {phoneVerification.remaining_attempts}
            </p>
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
