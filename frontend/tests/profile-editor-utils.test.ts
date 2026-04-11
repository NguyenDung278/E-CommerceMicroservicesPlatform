import { describe, expect, it } from "vitest";

import {
  buildProfileUpdatePayload,
  buildProfileValidationErrors,
  formatPhoneForOtpLabel,
  getPhoneVerificationDescription,
  getPhoneVerificationStatusLabel,
} from "@/features/account/utils/profile-editor";

describe("profile editor utilities", () => {
  it("formats vietnamese phone numbers for OTP labels", () => {
    expect(formatPhoneForOtpLabel("0912345678")).toBe("+84 912 345 678");
    expect(formatPhoneForOtpLabel("+84 912345678")).toBe("+84 912 345 678");
    expect(formatPhoneForOtpLabel("")).toBe("+84 XXX XXX XXX");
  });

  it("builds validation errors for invalid phone, short address, and missing otp", () => {
    expect(
      buildProfileValidationErrors({
        addressChanged: true,
        mergedAddressCandidate: {
          street: "12",
        },
        normalizedDraftPhone: "0123",
        otpCode: "12",
        phoneChanged: true,
        requireOtp: true,
      })
    ).toEqual({
      phone: "Phone number must contain exactly 10 digits and start with 0.",
      street: "Street address must be at least 5 characters.",
      otpCode: "OTP must contain exactly 6 digits.",
    });
  });

  it("creates a profile patch only for changed values", () => {
    expect(
      buildProfileUpdatePayload({
        currentFirstNameValue: "Nguyen",
        currentLastNameValue: "Dung",
        currentStreetValue: "12 Nguyen Trai",
        phoneChanged: true,
        phoneVerification: {
          verification_id: "verification-id",
          phone: "0912345678",
          phone_masked: "+84 912 *** 678",
          status: "verified",
          expires_in_seconds: 120,
          resend_in_seconds: 30,
          max_attempts: 5,
          remaining_attempts: 4,
        },
        profileForm: {
          firstName: " Nguyen ",
          lastName: "Dung",
          phone: "0912345678",
          street: "34 Le Loi",
          otpCode: "",
        },
      })
    ).toEqual({
      phone: "0912345678",
      phone_verification_id: "verification-id",
      default_address: {
        street: "34 Le Loi",
      },
    });
  });

  it("describes verification state consistently", () => {
    expect(
      getPhoneVerificationDescription({
        phoneChanged: false,
        phoneIsVerifiedForDraft: true,
        verificationPendingForDraft: false,
        userPhoneVerified: true,
      })
    ).toBe("Your current profile phone is already verified.");

    expect(
      getPhoneVerificationStatusLabel({
        phoneChanged: true,
        phoneIsVerifiedForDraft: false,
        verificationPendingForDraft: true,
        userPhoneVerified: false,
      })
    ).toBe("OTP pending");
  });
});
