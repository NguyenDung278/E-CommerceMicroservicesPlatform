/**
 * Sanitization Utilities - Backward Compatibility Layer
 * Re-exports from the new security modules
 */

export {
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
} from "./security/sanitization";
