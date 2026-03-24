/**
 * Input Sanitization Module
 * Provides comprehensive input sanitization functions to prevent
 * XSS attacks and ensure data integrity.
 */

/**
 * Sanitize plain text input
 * - Removes control characters
 * - Normalizes whitespace
 * - Trims leading/trailing spaces
 */
export function sanitizeText(value: string): string {
  return (
    value
      // Remove control characters (except newline and tab)
      .replace(/[\u0000-\u001f\u007f]/g, "")
      // Normalize multiple whitespace to single space
      .replace(/\s+/g, " ")
      // Trim leading/trailing whitespace
      .trim()
  );
}

/**
 * Sanitize multiline text input
 * - Allows newlines but removes other control characters
 */
export function sanitizeMultiline(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
}

/**
 * Sanitize email input
 * - Converts to lowercase
 * - Removes extra whitespace
 */
export function sanitizeEmail(value: string): string {
  return sanitizeText(value).toLowerCase();
}

/**
 * Sanitize URL input
 * - Validates URL format
 * - Ensures only http/https protocols
 * - Returns empty string for invalid URLs
 */
export function sanitizeUrl(value: string): string {
  const sanitized = sanitizeText(value);

  if (!sanitized) {
    return "";
  }

  try {
    const parsed = new URL(sanitized);

    // Only allow http and https protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Sanitize HTML content (for rich text)
 * - Escapes HTML special characters
 */
export function sanitizeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Convert string to positive integer
 * - Returns 0 for invalid input
 */
export function toPositiveInteger(value: string): number {
  const parsed = parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
}

/**
 * Convert string to positive float
 * - Returns 0 for invalid input
 */
export function toPositiveFloat(value: string): number {
  const parsed = parseFloat(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
}

/**
 * Sanitize file name
 * - Removes potentially dangerous characters
 */
export function sanitizeFileName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

/**
 * Sanitize identifier (for login)
 * - Removes extra whitespace
 * - Keeps email format intact
 */
export function sanitizeIdentifier(value: string): string {
  return value.trim();
}

/**
 * Sanitize order ID
 * - Ensures valid format for order identifiers
 */
export function sanitizeOrderId(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, "");
}

/**
 * Sanitize phone number
 * - Keeps only digits, spaces, and common phone symbols
 */
export function sanitizePhoneNumber(value: string): string {
  return value.replace(/[^\d\s+().-]/g, "").trim();
}

export default {
  sanitizeText,
  sanitizeMultiline,
  sanitizeEmail,
  sanitizeUrl,
  sanitizeHtml,
  toPositiveInteger,
  toPositiveFloat,
  sanitizeFileName,
  sanitizeIdentifier,
  sanitizeOrderId,
  sanitizePhoneNumber,
};
