import {
  sanitizeEmail,
  sanitizeMultiline,
  sanitizeText,
  sanitizeUrl,
  toPositiveFloat,
  toPositiveInteger
} from "./sanitize";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+]?[\d\s().-]{10,20}$/;
const passwordLetterPattern = /[A-Za-z]/;
const passwordDigitPattern = /\d/;

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

export type FormErrors<T extends Record<string, unknown>> = Partial<Record<keyof T, string>>;

export function isValidEmail(value: string) {
  return emailPattern.test(sanitizeEmail(value));
}

export function isValidPhone(value: string) {
  return phonePattern.test(sanitizeText(value));
}

export function isStrongPassword(value: string) {
  const trimmed = value.trim();

  return (
    trimmed.length >= 8 &&
    passwordLetterPattern.test(trimmed) &&
    passwordDigitPattern.test(trimmed)
  );
}

export function validateLoginFields(values: LoginFormValues): FormErrors<LoginFormValues> {
  const errors: FormErrors<LoginFormValues> = {};
  const identifier = sanitizeText(values.identifier);

  if (!identifier) {
    errors.identifier = "Vui lòng nhập email hoặc số điện thoại.";
  } else if (identifier.includes("@")) {
    if (!isValidEmail(identifier)) {
      errors.identifier = "Email chưa đúng định dạng.";
    }
  } else if (!isValidPhone(identifier)) {
    errors.identifier = "Số điện thoại chưa đúng định dạng.";
  }

  if (!sanitizeText(values.password)) {
    errors.password = "Vui lòng nhập mật khẩu.";
  }

  return errors;
}

export function validateRegisterFields(
  values: RegisterFormValues
): FormErrors<RegisterFormValues> {
  const errors: FormErrors<RegisterFormValues> = {};

  if (!sanitizeText(values.fullName)) {
    errors.fullName = "Vui lòng nhập họ và tên.";
  } else if (sanitizeText(values.fullName).split(" ").length < 2) {
    errors.fullName = "Hãy nhập đầy đủ họ và tên để giao hàng chính xác.";
  }

  if (!isValidEmail(values.email)) {
    errors.email = "Email chưa đúng định dạng.";
  }

  if (sanitizeText(values.phone) && !isValidPhone(values.phone)) {
    errors.phone = "Số điện thoại chưa đúng định dạng.";
  }

  if (!isStrongPassword(values.password)) {
    errors.password = "Mật khẩu cần ít nhất 8 ký tự và gồm cả chữ lẫn số.";
  }

  if (!values.confirmPassword.trim()) {
    errors.confirmPassword = "Vui lòng xác nhận lại mật khẩu.";
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Mật khẩu xác nhận chưa khớp.";
  }

  if (!values.agreeToTerms) {
    errors.agreeToTerms = "Bạn cần đồng ý với điều khoản và chính sách để tiếp tục.";
  }

  return errors;
}

export function validateRegister(values: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const errors: string[] = [];

  if (!isValidEmail(values.email)) {
    errors.push("Email không hợp lệ.");
  }
  if (!isStrongPassword(values.password)) {
    errors.push("Mật khẩu cần ít nhất 8 ký tự và gồm cả chữ lẫn số.");
  }
  if (!sanitizeText(values.firstName)) {
    errors.push("Tên không được để trống.");
  }
  if (!sanitizeText(values.lastName)) {
    errors.push("Họ không được để trống.");
  }

  return errors;
}

export function validateLogin(values: { email: string; password: string }) {
  const errors: string[] = [];

  if (!isValidEmail(values.email)) {
    errors.push("Email không hợp lệ.");
  }
  if (!sanitizeText(values.password)) {
    errors.push("Mật khẩu không được để trống.");
  }

  return errors;
}

export function validateProfile(values: { firstName: string; lastName: string }) {
  const errors: string[] = [];

  if (!sanitizeText(values.firstName)) {
    errors.push("Tên không được để trống.");
  }
  if (!sanitizeText(values.lastName)) {
    errors.push("Họ không được để trống.");
  }

  return errors;
}

export function validateProduct(values: {
  name: string;
  description: string;
  price: string;
  stock: string;
  imageUrl: string;
}) {
  const errors: string[] = [];

  if (!sanitizeText(values.name)) {
    errors.push("Tên sản phẩm không được để trống.");
  }
  if (toPositiveFloat(values.price) <= 0) {
    errors.push("Giá sản phẩm phải lớn hơn 0.");
  }
  if (Number.parseInt(values.stock, 10) < 0 || Number.isNaN(Number.parseInt(values.stock, 10))) {
    errors.push("Tồn kho phải là số nguyên >= 0.");
  }
  if (values.description && !sanitizeMultiline(values.description)) {
    errors.push("Mô tả không hợp lệ.");
  }
  if (values.imageUrl && !sanitizeUrl(values.imageUrl)) {
    errors.push("Ảnh URL phải bắt đầu bằng http:// hoặc https://.");
  }

  return errors;
}

export function validateOrder(values: { productId: string; quantity: string }) {
  const errors: string[] = [];

  if (!sanitizeText(values.productId)) {
    errors.push("Bạn chưa chọn sản phẩm.");
  }
  if (toPositiveInteger(values.quantity) <= 0) {
    errors.push("Số lượng phải lớn hơn 0.");
  }

  return errors;
}

export function validatePayment(values: {
  orderId: string;
  paymentMethod: string;
  amount?: string;
}) {
  const errors: string[] = [];

  if (!sanitizeText(values.orderId)) {
    errors.push("Mã đơn hàng không được để trống.");
  }
  if (!sanitizeText(values.paymentMethod)) {
    errors.push("Bạn chưa chọn phương thức thanh toán.");
  }
  if (values.amount && toPositiveFloat(values.amount) <= 0) {
    errors.push("Số tiền thanh toán phải lớn hơn 0.");
  }

  return errors;
}
