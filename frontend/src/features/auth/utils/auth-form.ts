import { sanitizeEmail, sanitizeText } from "@/utils/sanitize";
import type { FormErrors } from "@/utils/validation";

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

export function inputClassName(hasError: boolean) {
  return hasError ? "auth-field-input input-error" : "auth-field-input";
}
