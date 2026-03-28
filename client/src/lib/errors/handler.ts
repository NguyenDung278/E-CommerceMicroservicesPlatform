import type { HttpError } from "@/lib/api/http-client";

export function getErrorMessage(error: unknown): string {
  if (isHttpError(error)) {
    return getUserFriendlyMessage(error);
  }

  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch")) {
      return "Không kết nối được tới API Gateway. Hãy kiểm tra gateway tại http://localhost:8080.";
    }

    if (error.name === "AbortError") {
      return "Yêu cầu đã hết thời gian chờ.";
    }

    return error.message;
  }

  return "Có lỗi không xác định xảy ra.";
}

export function isHttpError(error: unknown): error is HttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "detail" in error
  );
}

function getUserFriendlyMessage(error: HttpError) {
  const { status, detail } = error;

  if (status === 409) {
    if (detail.includes("email already exists")) {
      return "Email đã tồn tại. Hãy đăng nhập hoặc dùng email khác.";
    }

    if (detail.includes("phone already exists")) {
      return "Số điện thoại đã được sử dụng. Hãy dùng số khác hoặc đăng nhập.";
    }

    if (detail.includes("already fully paid")) {
      return "Đơn hàng này đã được thanh toán đủ.";
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
  }

  if (status === 403) {
    return "Bạn không có quyền thực hiện thao tác này.";
  }

  if (status === 429) {
    if (detail.includes("before resending otp")) {
      return "Bạn vừa yêu cầu OTP. Hãy chờ thêm một chút rồi thử gửi lại.";
    }

    if (detail.includes("invalid otp attempts") || detail.includes("challenge has been locked")) {
      return "Bạn đã nhập sai OTP quá nhiều lần. Hãy gửi lại mã mới để tiếp tục.";
    }

    if (detail.includes("otp rate limit exceeded")) {
      return "Bạn đã vượt quá giới hạn gửi OTP tạm thời. Hãy thử lại sau.";
    }

    return detail || "Thao tác đang bị giới hạn tạm thời.";
  }

  if (status === 404) {
    return "Không tìm thấy dữ liệu yêu cầu.";
  }

  if (status === 422 || status === 400) {
    if (detail.includes("phone verification required")) {
      return "Số điện thoại mới cần được xác minh OTP trước khi lưu hồ sơ.";
    }

    if (detail.includes("phone verification is invalid or already used")) {
      return "Phiên xác minh số điện thoại không còn hợp lệ. Hãy gửi OTP lại.";
    }

    if (detail.includes("telegram chat not linked")) {
      return "Bot Telegram chưa thấy cuộc trò chuyện riêng tư nào. Hãy mở bot và gửi /start rồi thử lại.";
    }

    if (detail.includes("invalid phone number")) {
      return "Số điện thoại chưa đúng định dạng Việt Nam.";
    }

    return detail || error.message || "Dữ liệu không hợp lệ.";
  }

  if (detail) {
    return `${error.message}: ${detail}`;
  }

  return error.message;
}
