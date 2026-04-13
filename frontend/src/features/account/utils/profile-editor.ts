import type {
  Address,
  PhoneVerificationChallenge,
  ProfileAddressPatch,
  UserProfile,
} from "@/types/api";

export type ProfileFormState = {
  firstName: string;
  lastName: string;
  phone: string;
  otpCode: string;
};

export type ProfileFieldName = keyof ProfileFormState;

export type ProfileFieldErrors = Partial<Record<ProfileFieldName, string>>;

export type ProfileUpdatePayload = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  phone_verification_id?: string;
  default_address?: ProfileAddressPatch;
};

type BuildProfileValidationErrorsInput = {
  normalizedDraftPhone: string;
  phoneChanged: boolean;
  otpCode: string;
  requireOtp?: boolean;
};

type BuildProfileUpdatePayloadInput = {
  currentFirstNameValue: string;
  currentLastNameValue: string;
  phoneChanged: boolean;
  phoneVerification: PhoneVerificationChallenge | null;
  profileForm: ProfileFormState;
};

export const emptyProfileForm: ProfileFormState = {
  firstName: "",
  lastName: "",
  phone: "",
  otpCode: "",
};

export function getDefaultAddress(addresses: Address[]) {
  return addresses.find((item) => item.is_default) ?? addresses[0] ?? null;
}

export function createProfileFormState(
  user: UserProfile | null | undefined,
  defaultAddress: Address | null
): ProfileFormState {
  return {
    firstName: user?.first_name || "",
    lastName: user?.last_name || "",
    phone: user?.phone || defaultAddress?.phone || "",
    otpCode: "",
  };
}

export function normalizeProfileText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizePhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }

  return digits;
}

export function sanitizePhoneDraft(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function formatPhoneForOtpLabel(value: string) {
  const digits = value.replace(/\D/g, "");
  const localPhone = digits.startsWith("84")
    ? digits.slice(2)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  const visibleDigits = localPhone.slice(0, 9);
  const groups = [visibleDigits.slice(0, 3), visibleDigits.slice(3, 6), visibleDigits.slice(6, 9)]
    .filter(Boolean)
    .join(" ");

  return groups ? `+84 ${groups}` : "+84 XXX XXX XXX";
}

export function isValidVietnamesePhone(value: string) {
  return /^0\d{9}$/.test(value);
}

export function isValidStoredPhone(value: string) {
  return /^0\d{9,10}$/.test(value);
}

export function buildProfileValidationErrors({
  normalizedDraftPhone,
  otpCode,
  phoneChanged,
  requireOtp = false,
}: BuildProfileValidationErrorsInput): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

  if (phoneChanged && !isValidVietnamesePhone(normalizedDraftPhone)) {
    errors.phone = "Phone number must contain exactly 10 digits and start with 0.";
  }
  if (requireOtp && otpCode.trim().length !== 6) {
    errors.otpCode = "OTP must contain exactly 6 digits.";
  }

  return errors;
}

export function buildProfileUpdatePayload({
  currentFirstNameValue,
  currentLastNameValue,
  phoneChanged,
  phoneVerification,
  profileForm,
}: BuildProfileUpdatePayloadInput): ProfileUpdatePayload {
  const firstNameValue = normalizeProfileText(profileForm.firstName);
  const lastNameValue = normalizeProfileText(profileForm.lastName);

  const payload: ProfileUpdatePayload = {};

  if (firstNameValue !== "" && firstNameValue !== currentFirstNameValue) {
    payload.first_name = firstNameValue;
  }
  if (lastNameValue !== "" && lastNameValue !== currentLastNameValue) {
    payload.last_name = lastNameValue;
  }
  if (phoneChanged) {
    payload.phone = normalizePhoneDigits(profileForm.phone);
    payload.phone_verification_id = phoneVerification?.verification_id;
  }

  return payload;
}

export function buildProfileInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "ND";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function buildMemberSinceLabel(value?: string) {
  return `Member since ${extractYear(value)}`;
}

export function extractYear(value?: string) {
  const parsed = value ? new Date(value) : null;

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return "this year";
  }

  return String(parsed.getFullYear());
}

export function getProfileOrderStatusClassName(status: string) {
  const normalized = status.toLowerCase();

  if (
    normalized.includes("deliver") ||
    normalized.includes("paid") ||
    normalized.includes("success")
  ) {
    return "profile-route-status profile-route-status-success";
  }
  if (normalized.includes("process") || normalized.includes("pending")) {
    return "profile-route-status profile-route-status-processing";
  }

  return "profile-route-status";
}

export function formatCountdown(seconds: number) {
  if (seconds <= 0) {
    return "0s";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
}

export function getPhoneVerificationDescription(options: {
  phoneChanged: boolean;
  phoneIsVerifiedForDraft: boolean;
  verificationPendingForDraft: boolean;
  userPhoneVerified: boolean;
}) {
  const { phoneChanged, phoneIsVerifiedForDraft, verificationPendingForDraft, userPhoneVerified } =
    options;

  if (!phoneChanged) {
    return userPhoneVerified
      ? "Your current profile phone is already verified."
      : "Your current profile phone has not been verified yet.";
  }
  if (phoneIsVerifiedForDraft) {
    return "The new phone number has been verified. Save the profile to apply it.";
  }
  if (verificationPendingForDraft) {
    return "OTP has been sent to the new number. Enter it below to finish verification.";
  }

  return "Changing the profile phone requires Telegram OTP verification first.";
}

export function getPhoneVerificationStatusLabel(options: {
  phoneChanged: boolean;
  phoneIsVerifiedForDraft: boolean;
  verificationPendingForDraft: boolean;
  userPhoneVerified: boolean;
}) {
  const { phoneChanged, phoneIsVerifiedForDraft, verificationPendingForDraft, userPhoneVerified } =
    options;

  if (!phoneChanged) {
    return userPhoneVerified ? "Current number verified" : "Current number needs verification";
  }
  if (phoneIsVerifiedForDraft) {
    return "New number verified";
  }
  if (verificationPendingForDraft) {
    return "OTP pending";
  }

  return "Verification required";
}
