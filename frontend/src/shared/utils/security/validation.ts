import {
  sanitizeEmail,
  sanitizeText,
  sanitizeUrl,
} from "./sanitization";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+]?[\d\s().-]{10,20}$/;
const PASSWORD_LETTER_PATTERN = /[A-Za-z]/;
const PASSWORD_DIGIT_PATTERN = /\d/;

export function isValidEmail(value: string): boolean {
  const sanitized = sanitizeEmail(value);
  return EMAIL_PATTERN.test(sanitized);
}

export function isValidPhone(value: string): boolean {
  const sanitized = sanitizeText(value);
  return PHONE_PATTERN.test(sanitized);
}

export function isStrongPassword(value: string): boolean {
  const trimmed = value.trim();

  return trimmed.length >= 8 && PASSWORD_LETTER_PATTERN.test(trimmed) && PASSWORD_DIGIT_PATTERN.test(trimmed);
}

export function isNotEmpty(value: string): boolean {
  return sanitizeText(value).length > 0;
}

export function isValidLength(value: string, min: number, max: number): boolean {
  const length = value.trim().length;
  return length >= min && length <= max;
}

export function isInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

export function isValidUrl(value: string): boolean {
  return Boolean(sanitizeUrl(value));
}

export function isPositiveInteger(value: string): boolean {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 && Number.isInteger(parsed);
}

export function isPositiveFloat(value: string): boolean {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0;
}

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

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
};

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
