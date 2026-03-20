import { sanitizeEmail, sanitizeText } from "./sanitize";
import type { FormErrors } from "./validation";

export type TouchedFields<T extends Record<string, unknown>> = Partial<Record<keyof T, boolean>>;

export function getVisibleErrors<T extends Record<string, unknown>>(
  errors: FormErrors<T>,
  touched: TouchedFields<T>,
  showAll: boolean
) {
  if (showAll) {
    return errors;
  }

  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => touched[field as keyof T])
  ) as FormErrors<T>;
}

export function normalizeIdentifier(value: string) {
  const trimmed = sanitizeText(value);

  if (!trimmed) {
    return "";
  }

  return trimmed.includes("@") ? sanitizeEmail(trimmed) : trimmed;
}

export function splitFullName(value: string) {
  const normalized = sanitizeText(value);
  const parts = normalized.split(" ").filter(Boolean);

  if (parts.length <= 1) {
    return {
      firstName: normalized,
      lastName: ""
    };
  }

  return {
    firstName: parts[parts.length - 1],
    lastName: parts.slice(0, -1).join(" ")
  };
}

export function inputClassName(hasError: boolean) {
  return hasError ? "auth-field-input input-error" : "auth-field-input";
}
