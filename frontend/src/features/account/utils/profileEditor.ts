import type {
  Address,
  PhoneVerificationChallenge,
  ProfileAddressPatch,
  UserProfile,
} from "../../../shared/types/api";
import { getUserDisplayName } from "../../../shared/utils/devAccounts";

export type ProfileFormState = {
  firstName: string;
  lastName: string;
  phone: string;
  recipientName: string;
  street: string;
  ward: string;
  district: string;
  city: string;
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
  addressChanged: boolean;
  mergedAddressCandidate: {
    recipientName: string;
    phone: string;
    street: string;
    district: string;
    city: string;
  };
  normalizedDraftPhone: string;
  phoneChanged: boolean;
  otpCode: string;
  requireOtp?: boolean;
};

type BuildProfileUpdatePayloadInput = {
  currentCityValue: string;
  currentDistrictValue: string;
  currentFirstNameValue: string;
  currentLastNameValue: string;
  currentStreetValue: string;
  currentWardValue: string;
  defaultAddress: Address | null;
  fallbackRecipientName: string;
  phoneChanged: boolean;
  phoneVerification: PhoneVerificationChallenge | null;
  profileForm: ProfileFormState;
};

export const emptyProfileForm: ProfileFormState = {
  firstName: "",
  lastName: "",
  phone: "",
  recipientName: "",
  street: "",
  ward: "",
  district: "",
  city: "",
  otpCode: "",
};

export function getDefaultAddress(addresses: Address[]) {
  return addresses.find((item) => item.is_default) ?? addresses[0] ?? null;
}

export function createProfileFormState(
  user: UserProfile | null | undefined,
  defaultAddress: Address | null,
  displayName = getUserDisplayName(user)
): ProfileFormState {
  return {
    firstName: user?.first_name || "",
    lastName: user?.last_name || "",
    phone: user?.phone || "",
    recipientName: defaultAddress?.recipient_name || displayName,
    street: defaultAddress?.street || "",
    ward: defaultAddress?.ward || "",
    district: defaultAddress?.district || "",
    city: defaultAddress?.city || "",
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

export function isValidVietnamesePhone(value: string) {
  return /^0\d{9}$/.test(value);
}

export function isValidStoredPhone(value: string) {
  return /^0\d{9,10}$/.test(value);
}

export function buildProfileValidationErrors({
  addressChanged,
  mergedAddressCandidate,
  normalizedDraftPhone,
  otpCode,
  phoneChanged,
  requireOtp = false,
}: BuildProfileValidationErrorsInput): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {};

  if (phoneChanged && !isValidVietnamesePhone(normalizedDraftPhone)) {
    errors.phone = "Phone number must contain exactly 10 digits and start with 0.";
  }
  if (addressChanged && !mergedAddressCandidate.recipientName) {
    errors.recipientName = "Recipient name is required.";
  }
  if (addressChanged && !isValidStoredPhone(mergedAddressCandidate.phone)) {
    errors.street = "Add a valid profile phone before saving the default address.";
  }
  if (addressChanged && mergedAddressCandidate.street.length < 5) {
    errors.street = "Street address must be at least 5 characters.";
  }
  if (addressChanged && mergedAddressCandidate.district.length < 2) {
    errors.district = "District is required.";
  }
  if (addressChanged && mergedAddressCandidate.city.length < 2) {
    errors.city = "City is required.";
  }
  if (requireOtp && otpCode.trim().length !== 6) {
    errors.otpCode = "OTP must contain exactly 6 digits.";
  }

  return errors;
}

export function buildProfileUpdatePayload({
  currentCityValue,
  currentDistrictValue,
  currentFirstNameValue,
  currentLastNameValue,
  currentStreetValue,
  currentWardValue,
  defaultAddress,
  fallbackRecipientName,
  phoneChanged,
  phoneVerification,
  profileForm,
}: BuildProfileUpdatePayloadInput): ProfileUpdatePayload {
  const firstNameValue = normalizeProfileText(profileForm.firstName);
  const lastNameValue = normalizeProfileText(profileForm.lastName);
  const recipientNameValue = normalizeProfileText(profileForm.recipientName);
  const streetValue = profileForm.street.trim();
  const wardValue = profileForm.ward.trim();
  const districtValue = profileForm.district.trim();
  const cityValue = profileForm.city.trim();

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

  const nextAddressPatch: ProfileAddressPatch = {};
  if (!defaultAddress && recipientNameValue !== "") {
    nextAddressPatch.recipient_name = recipientNameValue;
  } else if (recipientNameValue !== "" && recipientNameValue !== fallbackRecipientName) {
    nextAddressPatch.recipient_name = recipientNameValue;
  }
  if (streetValue !== "" && streetValue !== currentStreetValue) {
    nextAddressPatch.street = streetValue;
  }
  if (wardValue !== "" && wardValue !== currentWardValue) {
    nextAddressPatch.ward = wardValue;
  }
  if (districtValue !== "" && districtValue !== currentDistrictValue) {
    nextAddressPatch.district = districtValue;
  }
  if (cityValue !== "" && cityValue !== currentCityValue) {
    nextAddressPatch.city = cityValue;
  }
  if (Object.keys(nextAddressPatch).length > 0) {
    payload.default_address = nextAddressPatch;
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

  if (normalized.includes("deliver") || normalized.includes("paid") || normalized.includes("success")) {
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
  const {
    phoneChanged,
    phoneIsVerifiedForDraft,
    verificationPendingForDraft,
    userPhoneVerified,
  } = options;

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
