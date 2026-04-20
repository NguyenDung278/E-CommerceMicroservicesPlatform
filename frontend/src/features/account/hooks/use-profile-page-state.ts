import { useEffect, useMemo, useState, type FormEvent } from "react";

import { useAuth } from "../../auth/hooks/use-auth";
import { getErrorMessage } from "@/services/api";
import type { PhoneVerificationChallenge } from "@/types/api";
import { getUserDisplayName, isDevelopmentAccount } from "@/utils/dev-accounts";
import { useOrderPayments } from "./use-order-payments";
import { useSavedAddresses } from "./use-saved-addresses";
import {
  buildMemberSinceLabel,
  buildProfileInitials,
  buildProfileUpdatePayload,
  buildProfileValidationErrors,
  createProfileFormState,
  emptyProfileForm,
  formatCountdown,
  getDefaultAddress,
  normalizePhoneDigits,
  normalizeProfileText,
  sanitizePhoneDraft,
  type ProfileFieldErrors,
  type ProfileFieldName,
  type ProfileFormState,
} from "../utils/profile-editor";

export function useProfilePageState() {
  const {
    token,
    user,
    refreshProfile,
    updateProfile,
    resendVerificationEmail,
    getPhoneVerificationStatus,
    sendPhoneOtp,
    verifyPhoneOtp,
    resendPhoneOtp,
  } = useAuth();
  const { orders, isLoading: isOrdersLoading } = useOrderPayments(token);
  const { addresses, refreshAddresses } = useSavedAddresses(token);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(emptyProfileForm);
  const [formErrors, setFormErrors] = useState<ProfileFieldErrors>({});
  const [feedback, setFeedback] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isOtpBusy, setIsOtpBusy] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [phoneVerification, setPhoneVerification] = useState<PhoneVerificationChallenge | null>(
    null
  );
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [otpResendIn, setOtpResendIn] = useState(0);

  const defaultAddress = useMemo(() => getDefaultAddress(addresses), [addresses]);
  const displayName = getUserDisplayName(user);
  const recentOrders = useMemo(() => orders.slice(0, 3), [orders]);
  const memberSince = useMemo(() => buildMemberSinceLabel(user?.created_at), [user?.created_at]);
  const initials = useMemo(() => buildProfileInitials(displayName), [displayName]);
  const locationLabel = defaultAddress
    ? defaultAddress.location.trim() || "No saved delivery location yet"
    : "No saved delivery location yet";
  const showDevBadge = isDevelopmentAccount(user);

  useEffect(() => {
    setProfileForm(createProfileFormState(user, defaultAddress));
  }, [defaultAddress, user]);

  useEffect(() => {
    if (!token) {
      setPhoneVerification(null);
      setOtpExpiresIn(0);
      setOtpResendIn(0);
      return;
    }

    let active = true;

    // Keep pending OTP challenges after refresh so the user can continue verification.
    void getPhoneVerificationStatus()
      .then((status) => {
        if (!active) {
          return;
        }

        setPhoneVerification(status);
        setOtpExpiresIn(status?.expires_in_seconds ?? 0);
        setOtpResendIn(status?.resend_in_seconds ?? 0);

        if (status?.phone) {
          setProfileForm((current) => ({
            ...current,
            phone: status.phone,
          }));
          setIsEditingProfile(true);
        }
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setPhoneVerification(null);
        setOtpExpiresIn(0);
        setOtpResendIn(0);
      });

    return () => {
      active = false;
    };
  }, [getPhoneVerificationStatus, token]);

  useEffect(() => {
    if (!phoneVerification) {
      setOtpExpiresIn(0);
      setOtpResendIn(0);
      return;
    }

    setOtpExpiresIn(phoneVerification.expires_in_seconds);
    setOtpResendIn(phoneVerification.resend_in_seconds);

    const timer = window.setInterval(() => {
      setOtpExpiresIn((current) => (current > 0 ? current - 1 : 0));
      setOtpResendIn((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [phoneVerification]);

  const normalizedCurrentPhone = normalizePhoneDigits(user?.phone || "");
  const normalizedDraftPhone = normalizePhoneDigits(profileForm.phone);
  const verificationPhone = normalizePhoneDigits(phoneVerification?.phone || "");
  const phoneChanged = normalizedDraftPhone !== normalizedCurrentPhone;
  const verificationMatchesDraft =
    verificationPhone !== "" && verificationPhone === normalizedDraftPhone;
  const phoneIsVerifiedForDraft =
    !phoneChanged || (phoneVerification?.status === "verified" && verificationMatchesDraft);
  const verificationPendingForDraft =
    phoneChanged && phoneVerification?.status === "pending" && verificationMatchesDraft;
  const otpPanelVisible = phoneChanged && !phoneIsVerifiedForDraft;

  const firstNameValue = normalizeProfileText(profileForm.firstName);
  const lastNameValue = normalizeProfileText(profileForm.lastName);
  const currentFirstNameValue = normalizeProfileText(user?.first_name || "");
  const currentLastNameValue = normalizeProfileText(user?.last_name || "");
  const nameChanged =
    (firstNameValue !== "" && firstNameValue !== currentFirstNameValue) ||
    (lastNameValue !== "" && lastNameValue !== currentLastNameValue);
  const hasProfileChanges = nameChanged || phoneChanged;
  const clientValidationErrors = buildProfileValidationErrors({
    normalizedDraftPhone,
    otpCode: profileForm.otpCode,
    phoneChanged,
  });
  const hasValidPhoneDraft = phoneChanged && !clientValidationErrors.phone;
  const canSubmit =
    !isSaving &&
    !isOtpBusy &&
    phoneIsVerifiedForDraft &&
    hasProfileChanges &&
    Object.keys(clientValidationErrors).length === 0;

  function handleFieldChange(field: ProfileFieldName, value: string) {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
    setFormErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  }

  function resetVerificationState() {
    setPhoneVerification(null);
    setOtpExpiresIn(0);
    setOtpResendIn(0);
    setProfileForm((current) => ({
      ...current,
      otpCode: "",
    }));
  }

  function handlePhoneChange(value: string) {
    const sanitizedPhone = sanitizePhoneDraft(value);
    handleFieldChange("phone", sanitizedPhone);
    if (
      normalizePhoneDigits(phoneVerification?.phone || "") !== normalizePhoneDigits(sanitizedPhone)
    ) {
      resetVerificationState();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = { ...clientValidationErrors };
    if (phoneChanged && !phoneIsVerifiedForDraft) {
      nextErrors.phone =
        nextErrors.phone || "Phone change must be verified with OTP before saving.";
    }
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback("Please review the profile form before saving.");
      return;
    }
    if (!hasProfileChanges) {
      setFeedback("No profile changes to save yet.");
      return;
    }

    const profilePatch = buildProfileUpdatePayload({
      currentFirstNameValue,
      currentLastNameValue,
      phoneChanged,
      phoneVerification,
      profileForm,
    });

    try {
      setIsSaving(true);
      await updateProfile(profilePatch);
      await Promise.all([refreshProfile(), refreshAddresses()]);
      resetVerificationState();
      setFormErrors({});
      setFeedback("Your profile changes were saved successfully.");
      setIsEditingProfile(false);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendPhoneOtp() {
    setFormErrors(clientValidationErrors);
    if (clientValidationErrors.phone) {
      setFeedback(clientValidationErrors.phone || "Unable to send OTP for this phone number.");
      return;
    }
    if (!phoneChanged) {
      setFeedback("Enter a new 10-digit phone number before requesting verification.");
      return;
    }

    try {
      setIsOtpBusy(true);
      const result = await sendPhoneOtp(normalizedDraftPhone);
      setPhoneVerification(result ?? null);
      setOtpExpiresIn(result?.expires_in_seconds ?? 0);
      setOtpResendIn(result?.resend_in_seconds ?? 0);
      handleFieldChange("otpCode", "");
      setFeedback("");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsOtpBusy(false);
    }
  }

  async function handleVerifyPhoneOtp() {
    if (!phoneVerification?.verification_id) {
      return;
    }

    const nextErrors = buildProfileValidationErrors({
      normalizedDraftPhone,
      otpCode: profileForm.otpCode,
      phoneChanged,
      requireOtp: true,
    });
    setFormErrors(nextErrors);
    if (nextErrors.otpCode) {
      setFeedback(nextErrors.otpCode);
      return;
    }

    try {
      setIsOtpBusy(true);
      const result = await verifyPhoneOtp(
        phoneVerification.verification_id,
        profileForm.otpCode.trim()
      );
      setPhoneVerification(result ?? null);
      setOtpExpiresIn(result?.expires_in_seconds ?? 0);
      setOtpResendIn(result?.resend_in_seconds ?? 0);
      setFeedback("");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsOtpBusy(false);
    }
  }

  async function handleResendPhoneOtp() {
    if (!phoneVerification?.verification_id) {
      return;
    }

    try {
      setIsOtpBusy(true);
      const result = await resendPhoneOtp(phoneVerification.verification_id);
      setPhoneVerification(result ?? null);
      setOtpExpiresIn(result?.expires_in_seconds ?? 0);
      setOtpResendIn(result?.resend_in_seconds ?? 0);
      handleFieldChange("otpCode", "");
      setFeedback("A fresh OTP has been sent to Telegram.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsOtpBusy(false);
    }
  }

  async function handleResendVerification() {
    try {
      setIsResendingVerification(true);
      await resendVerificationEmail();
      setFeedback("A new verification email has been sent to your inbox.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsResendingVerification(false);
    }
  }

  return {
    addresses,
    displayName,
    feedback,
    formatCountdown,
    formErrors,
    handleFieldChange,
    handlePhoneChange,
    handleResendPhoneOtp,
    handleResendVerification,
    handleSendPhoneOtp,
    handleSubmit,
    handleVerifyPhoneOtp,
    hasValidPhoneDraft,
    initials,
    isEditingProfile,
    isOrdersLoading,
    isOtpBusy,
    isResendingVerification,
    isSaving,
    locationLabel,
    memberSince,
    orders,
    otpExpiresIn,
    otpPanelVisible,
    otpResendIn,
    phoneChanged,
    phoneIsVerifiedForDraft,
    phoneVerification,
    profileForm,
    recentOrders,
    setIsEditingProfile,
    showDevBadge,
    user,
    verificationPendingForDraft,
    canSubmit,
  };
}
