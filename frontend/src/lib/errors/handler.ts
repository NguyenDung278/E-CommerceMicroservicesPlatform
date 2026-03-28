/**
 * Error Handling Module
 * Provides centralized error handling, error message extraction,
 * and error mapping for user-friendly feedback.
 */

import type { HttpError } from "../http/client";

/**
 * Error codes for different types of errors
 */
export const ErrorCode = {
  NETWORK_ERROR: "NETWORK_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  SERVER_ERROR: "SERVER_ERROR",
  TIMEOUT: "TIMEOUT",
  UNKNOWN: "UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Get error code from HTTP status
 */
export function getErrorCode(status: number | string): ErrorCode {
  const statusNum = typeof status === "string" ? parseInt(status, 10) : status;
  if (statusNum === 0) {
    return ErrorCode.NETWORK_ERROR;
  }
  if (status === 401) {
    return ErrorCode.UNAUTHORIZED;
  }
  if (status === 403) {
    return ErrorCode.FORBIDDEN;
  }
  if (status === 404) {
    return ErrorCode.NOT_FOUND;
  }
  if (status === 409) {
    return ErrorCode.CONFLICT;
  }
  if (status === 422 || status === 400) {
    return ErrorCode.VALIDATION_ERROR;
  }
  if (statusNum >= 500) {
    return ErrorCode.SERVER_ERROR;
  }
  return ErrorCode.UNKNOWN;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
    return true;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }
  return false;
}

/**
 * Get user-friendly error message from error object
 */
export function getErrorMessage(error: unknown): string {
  // Handle our custom HttpError
  if (isHttpError(error)) {
    return getUserFriendlyMessage(error);
  }

  // Handle standard Error
  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch")) {
      return "Không kết nối được đến API Gateway. Frontend hiện gọi cùng origin `/api`; hãy kiểm tra `http://localhost:8080/health` hoặc `http://localhost:4173/health`.";
    }
    if (error.name === "AbortError") {
      return "Yêu cầu bị hủy do quá thời gian chờ.";
    }
    return error.message;
  }

  // Handle unknown errors
  return "Có lỗi không xác định xảy ra.";
}

/**
 * Get HTTP error details
 */
export function isHttpError(error: unknown): error is HttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "detail" in error
  );
}

/**
 * Map specific error patterns to user-friendly messages
 */
function getUserFriendlyMessage(error: HttpError): string {
  const { status, detail } = error;

  // Handle specific status codes
  if (status === 409) {
    if (detail.includes("email already exists")) {
      return "Email đã tồn tại. Hãy đăng nhập hoặc dùng email khác.";
    }
    if (detail.includes("phone already exists")) {
      return "Số điện thoại đã được sử dụng. Hãy dùng số khác hoặc đăng nhập.";
    }
    if (detail.includes("oauth")) {
      return "Không thể liên kết tài khoản mạng xã hội do dữ liệu đang xung đột.";
    }
  }

  if (status === 401) {
    if (detail.includes("invalid email/phone or password")) {
      return "Thông tin đăng nhập hoặc mật khẩu chưa chính xác.";
    }
    if (detail.includes("invalid or expired verification token")) {
      return "Liên kết xác minh email không hợp lệ hoặc đã hết hạn.";
    }
    if (detail.includes("invalid or expired reset token")) {
      return "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.";
    }
    if (detail.includes("invalid or expired token")) {
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    }
    if (detail.includes("invalid or expired oauth login ticket")) {
      return "Phiên đăng nhập mạng xã hội đã hết hạn. Hãy thử lại từ màn hình đăng nhập.";
    }
  }

  if (status === 403) {
    return "Bạn không có quyền thực hiện thao tác này.";
  }

  if (status === 429) {
    if (detail.includes("before resending otp")) {
      return "Bạn vừa yêu cầu OTP. Hãy chờ thêm một chút rồi thử gửi lại.";
    }
    if (detail.includes("invalid otp attempts") || detail.includes("challenge has been locked")) {
      return "Bạn đã nhập sai OTP quá nhiều lần. Hãy gửi OTP mới để tiếp tục.";
    }
    if (detail.includes("otp rate limit exceeded")) {
      return "Bạn đã vượt quá giới hạn gửi OTP tạm thời. Hãy thử lại sau.";
    }
    return detail || "Thao tác đang bị giới hạn tạm thời.";
  }

  if (status === 404) {
    return "Không tìm thấy tài nguyên yêu cầu.";
  }

  if (status === 422) {
    return detail || "Dữ liệu không hợp lệ.";
  }

  if (status === 400) {
    if (detail.includes("oauth")) {
      return detail;
    }
    if (detail.includes("phone verification required")) {
      return "Số điện thoại mới cần được xác minh OTP trước khi lưu hồ sơ.";
    }
    if (detail.includes("phone verification is invalid or already used")) {
      return "Phiên xác minh số điện thoại không còn hợp lệ. Hãy gửi OTP lại.";
    }
    if (detail.includes("invalid telegram chat id")) {
      return "Telegram chat ID không hợp lệ.";
    }
    if (detail.includes("invalid phone number")) {
      return "Số điện thoại chưa đúng định dạng Việt Nam.";
    }
    return detail || "Dữ liệu không hợp lệ.";
  }

  // Generic message with details
  if (detail) {
    return `${error.message}: ${detail}`;
  }

  return error.message;
}

/**
 * Log error to console (can be extended to send to error tracking service)
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const errorInfo: Record<string, unknown> = {
    timestamp,
    context,
  };

  if (isHttpError(error)) {
    errorInfo.status = error.status;
    errorInfo.detail = error.detail;
    errorInfo.code = error.code;
  }

  if (error instanceof Error) {
    errorInfo.name = error.name;
    errorInfo.message = error.message;
    errorInfo.stack = error.stack;
  } else {
    errorInfo.error = error;
  }

  console.error("[Error]", timestamp, errorInfo);
}

/**
 * Create a typed error handler function
 */
export function createErrorHandler(
  onError?: (message: string) => void
): (error: unknown) => void {
  return (error: unknown) => {
    const message = getErrorMessage(error);
    logError(error);
    onError?.(message);
  };
}

export default {
  ErrorCode,
  getErrorCode,
  isNetworkError,
  getErrorMessage,
  isHttpError,
  logError,
  createErrorHandler,
};
