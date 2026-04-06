/**
 * Input Sanitization Module
 * Provides comprehensive input sanitization functions to prevent
 * XSS attacks and ensure data integrity.
 */

function stripControlCharacters(
  value: string,
  options: { preserveLineBreaks?: boolean } = {}
): string {
  let result = "";

  for (const character of value) {
    const code = character.charCodeAt(0);
    const isAsciiControl = (code >= 0 && code <= 31) || code === 127;
    const isLineBreak = character === "\n" || character === "\r";

    if (!isAsciiControl || (options.preserveLineBreaks && isLineBreak)) {
      result += character;
    }
  }

  return result;
}

export function sanitizeText(value: string): string {
  return stripControlCharacters(value).replace(/\s+/g, " ").trim();
}

export function sanitizeMultiline(value: string): string {
  return stripControlCharacters(value, { preserveLineBreaks: true }).trim();
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
  return value
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .trim();
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
