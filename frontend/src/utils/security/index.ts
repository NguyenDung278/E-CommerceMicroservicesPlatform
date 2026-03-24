/**
 * Security Utilities Index
 * Central export point for security-related utilities
 */

// Re-export sanitization functions
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
} from "./sanitization";

// Re-export validation functions
export {
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
  type ValidationResult,
} from "./validation";
