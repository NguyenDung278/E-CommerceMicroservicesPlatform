import {
  sanitizeEmail,
  sanitizeMultiline,
  sanitizeText,
  sanitizeUrl,
  toPositiveFloat,
  toPositiveInteger
} from "./sanitize";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister(values: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const errors: string[] = [];

  if (!emailPattern.test(sanitizeEmail(values.email))) {
    errors.push("Email không hợp lệ.");
  }
  if (values.password.trim().length < 8) {
    errors.push("Mật khẩu cần ít nhất 8 ký tự.");
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

  if (!emailPattern.test(sanitizeEmail(values.email))) {
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
  amount: string;
  paymentMethod: string;
}) {
  const errors: string[] = [];

  if (!sanitizeText(values.orderId)) {
    errors.push("Mã đơn hàng không được để trống.");
  }
  if (toPositiveFloat(values.amount) <= 0) {
    errors.push("Số tiền thanh toán phải lớn hơn 0.");
  }
  if (!sanitizeText(values.paymentMethod)) {
    errors.push("Bạn chưa chọn phương thức thanh toán.");
  }

  return errors;
}
