/**
 * Input Validation Module
 * Provides comprehensive input validation functions for
 * form fields, user inputs, and API parameters.
 */

import {
  sanitizeText,
  sanitizeEmail,
  sanitizeUrl,
  toPositiveInteger,
  toPositiveFloat,
} from "./sanitization";

// Validation patterns
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+]?[\d\s().-]{10,20}$/;
const PASSWORD_LETTER_PATTERN = /[A-Za-z]/;
const PASSWORD_DIGIT_PATTERN = /\d/;

/**
 * Validate email format
 */
export function isValidEmail(value: string): boolean {
  const sanitized = sanitizeEmail(value);
  return EMAIL_PATTERN.test(sanitized);
}

/**
 * Validate phone number format
 */
export function isValidPhone(value: string): boolean {
  const sanitized = sanitizeText(value);
  return PHONE_PATTERN.test(sanitized);
}

/**
 * Validate password strength
 * Requirements: at least 8 characters, contains both letters and numbers
 */
export function isStrongPassword(value: string): boolean {
  const trimmed = value.trim();

  return (
    trimmed.length >= 8 &&
    PASSWORD_LETTER_PATTERN.test(trimmed) &&
    PASSWORD_DIGIT_PATTERN.test(trimmed)
  );
}

/**
 * Validate that a string is not empty after sanitization
 */
export function isNotEmpty(value: string): boolean {
  return sanitizeText(value).length > 0;
}

/**
 * Validate length constraints
 */
export function isValidLength(
  value: string,
  min: number,
  max: number
): boolean {
  const length = value.trim().length;
  return length >= min && length <= max;
}

/**
 * Validate numeric value is within range
 */
export function isInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

/**
 * Validate URL format
 */
export function isValidUrl(value: string): boolean {
  return Boolean(sanitizeUrl(value));
}

/**
 * Validate positive integer
 */
export function isPositiveInteger(value: string): boolean {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 && Number.isInteger(parsed);
}

/**
 * Validate positive float
 */
export function isPositiveFloat(value: string): boolean {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0;
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  email: {
    required: true,
    validate: isValidEmail,
    message: "Email chưa đúng định dạng.",
  },
  phone: {
    required: true,
    validate: isValidPhone,
    message: "Số điện thoại chưa đúng định dạng.",
  },
  password: {
    required: true,
    validate: isStrongPassword,
    message: "Mật khẩu cần ít nhất 8 ký tự và gồm cả chữ lẫn số.",
  },
  required: {
    required: true,
    validate: isNotEmpty,
    message: "Trường này không được để trống.",
  },
} as const;

/**
 * Create a validation result
 */
export type ValidationResult = {
  isValid: boolean;
  errors: string[];
};

/**
 * Validate a value against a set of rules
 */
export function validateField(
  value: string,
  rules: Array<{
    validate: (value: string) => boolean;
    message: string;
    required?: boolean;
  }>
): ValidationResult {
  const errors: string[] = [];

  for (const rule of rules) {
    // Skip optional fields if value is empty
    if (rule.required === false && !value.trim()) {
      continue;
    }

    if (!rule.validate(value)) {
      errors.push(rule.message);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export default {
  isValidEmail,
  isValidPhone,
  isStrongPassword,
  isNotEmpty,
  isValidLength,
  isInRange,
  isValidUrl,
  isPositiveInteger,
  isPositiveFloat,
  ValidationRules,
  validateField,
};
