/**
 * Input Sanitization Module
 * Provides comprehensive input sanitization functions to prevent
 * XSS attacks and ensure data integrity.
 */

export function sanitizeText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
}

export function sanitizeMultiline(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
}

export function sanitizeEmail(value: string): string {
  return sanitizeText(value).toLowerCase();
}

export function sanitizeUrl(value: string): string {
  const sanitized = sanitizeText(value);

  if (!sanitized) {
    return "";
  }

  try {
    const parsed = new URL(sanitized);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

export function sanitizeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function toPositiveInteger(value: string): number {
  const parsed = parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.floor(parsed);
}

export function toPositiveFloat(value: string): number {
  const parsed = parseFloat(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return parsed;
}

export function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").trim();
}

export function sanitizeIdentifier(value: string): string {
  return value.trim();
}

export function sanitizeOrderId(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, "");
}

export function sanitizePhoneNumber(value: string): string {
  return value.replace(/[^\d\s+().-]/g, "").trim();
}
