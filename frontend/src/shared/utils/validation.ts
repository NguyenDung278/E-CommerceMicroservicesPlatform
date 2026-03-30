/**
 * Shared validation helpers for route forms and feature-level inputs.
 */

import { sanitizeIdentifier, sanitizePhoneNumber, sanitizeText, sanitizeUrl } from "./sanitize";
import {
  isNotEmpty,
  isPositiveFloat,
  isPositiveInteger,
  isStrongPassword,
  isValidEmail,
  isValidLength,
  validateField,
  ValidationRules,
  type ValidationResult,
} from "./security/validation";

export {
  isValidEmail,
  isStrongPassword,
  isNotEmpty,
  isValidLength,
  isPositiveInteger,
  isPositiveFloat,
  validateField,
  ValidationRules,
  type ValidationResult,
} from "./security/validation";
export { isValidPhone, isInRange, isValidUrl } from "./security/validation";

export type FormErrors<T extends Record<string, unknown>> = Partial<Record<keyof T, string>>;

export type LoginFormValues = {
  identifier: string;
  password: string;
  rememberMe: boolean;
};

export type RegisterFormValues = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
};

type ProfileValues = {
  firstName: string;
  lastName: string;
};

type ProductValidationValues = {
  name: string;
  description: string;
  price: string;
  stock: string;
  imageUrl?: string;
};

type PaymentValidationValues = {
  orderId: string;
  paymentMethod: string;
  amount: string;
};

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 5000;

export function validateLoginFields(values: LoginFormValues): FormErrors<LoginFormValues> {
  const errors: FormErrors<LoginFormValues> = {};
  const identifier = sanitizeIdentifier(values.identifier);

  if (!identifier) {
    errors.identifier = "Email hoặc số điện thoại không được để trống.";
  } else if (identifier.includes("@") && !isValidEmail(identifier)) {
    errors.identifier = "Email chưa đúng định dạng.";
  } else if (!identifier.includes("@") && sanitizePhoneNumber(identifier).length < 10) {
    errors.identifier = "Số điện thoại chưa đúng định dạng.";
  }

  if (!values.password.trim()) {
    errors.password = "Mật khẩu không được để trống.";
  }

  return errors;
}

export function validateRegisterFields(values: RegisterFormValues): FormErrors<RegisterFormValues> {
  const errors: FormErrors<RegisterFormValues> = {};
  const fullName = sanitizeText(values.fullName);
  const email = sanitizeText(values.email);
  const phone = sanitizePhoneNumber(values.phone);

  if (!fullName) {
    errors.fullName = "Họ tên không được để trống.";
  } else if (!isValidLength(fullName, 2, MAX_NAME_LENGTH)) {
    errors.fullName = "Họ tên cần từ 2 đến 120 ký tự.";
  }

  if (!email) {
    errors.email = "Email không được để trống.";
  } else if (!isValidEmail(email)) {
    errors.email = "Email chưa đúng định dạng.";
  }

  if (phone && phone.length < 10) {
    errors.phone = "Số điện thoại cần ít nhất 10 ký tự số.";
  }

  if (!values.password.trim()) {
    errors.password = "Mật khẩu không được để trống.";
  } else if (!isStrongPassword(values.password)) {
    errors.password = "Mật khẩu cần ít nhất 8 ký tự và gồm cả chữ lẫn số.";
  }

  if (!values.confirmPassword.trim()) {
    errors.confirmPassword = "Hãy xác nhận lại mật khẩu.";
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Mật khẩu xác nhận chưa khớp.";
  }

  if (!values.agreeToTerms) {
    errors.agreeToTerms = "Bạn cần đồng ý với điều khoản để tiếp tục.";
  }

  return errors;
}

export function validateProfile(values: ProfileValues): string[] {
  const errors: string[] = [];
  const firstName = sanitizeText(values.firstName);
  const lastName = sanitizeText(values.lastName);
  const displayName = `${lastName} ${firstName}`.trim();

  if (!firstName) {
    errors.push("Tên không được để trống.");
  }
  if (!displayName) {
    errors.push("Hồ sơ cần có ít nhất một tên hiển thị.");
  }
  if (displayName && !isValidLength(displayName, 2, MAX_NAME_LENGTH)) {
    errors.push("Tên hiển thị cần từ 2 đến 120 ký tự.");
  }

  return errors;
}

export function validateProduct(values: ProductValidationValues): string[] {
  const errors: string[] = [];

  if (!sanitizeText(values.name)) {
    errors.push("Tên sản phẩm không được để trống.");
  } else if (!isValidLength(values.name, 2, MAX_NAME_LENGTH)) {
    errors.push("Tên sản phẩm cần từ 2 đến 120 ký tự.");
  }

  if (!sanitizeText(values.description)) {
    errors.push("Mô tả sản phẩm không được để trống.");
  } else if (!isValidLength(values.description, 10, MAX_DESCRIPTION_LENGTH)) {
    errors.push("Mô tả sản phẩm cần ít nhất 10 ký tự.");
  }

  if (!isPositiveFloat(values.price)) {
    errors.push("Giá sản phẩm phải lớn hơn 0.");
  }

  const stockValue = Number.parseInt(values.stock, 10);
  if (Number.isNaN(stockValue) || stockValue < 0) {
    errors.push("Tồn kho phải là số nguyên không âm.");
  }

  if (values.imageUrl && !sanitizeUrl(values.imageUrl)) {
    errors.push("Ảnh đại diện phải là URL http:// hoặc https:// hợp lệ.");
  }

  return errors;
}

export function validatePayment(values: PaymentValidationValues): string[] {
  const errors: string[] = [];

  if (!sanitizeText(values.orderId)) {
    errors.push("Thiếu mã đơn hàng để xử lý thanh toán.");
  }

  if (!sanitizeText(values.paymentMethod)) {
    errors.push("Phương thức thanh toán không được để trống.");
  }

  if (values.amount.trim() && !isPositiveFloat(values.amount)) {
    errors.push("Số tiền thanh toán phải lớn hơn 0.");
  }

  return errors;
}
