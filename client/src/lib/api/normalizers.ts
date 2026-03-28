import type {
  Address,
  Cart,
  CartItem,
  Order,
  OrderEvent,
  OrderItem,
  OrderPreview,
  Payment,
  Product,
  ProductPopularity,
  ProductRatingBreakdown,
  ProductReview,
  ProductReviewList,
  ProductReviewSummary,
  ProductVariant,
  ShippingAddress,
  UserProfile,
  ProfileAddressInput,
  PhoneVerificationChallenge,
} from "@/types/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

export function normalizeProductVariant(value: unknown): ProductVariant {
  const variant = isRecord(value) ? value : {};

  return {
    sku: normalizeString(variant.sku),
    label: normalizeString(variant.label),
    size: normalizeString(variant.size) || undefined,
    color: normalizeString(variant.color) || undefined,
    price: normalizeNumber(variant.price),
    stock: normalizeNumber(variant.stock),
  };
}

export function normalizeProduct(value: unknown): Product {
  const product = isRecord(value) ? value : {};

  return {
    id: normalizeString(product.id),
    name: normalizeString(product.name),
    description: normalizeString(product.description),
    price: normalizeNumber(product.price),
    stock: normalizeNumber(product.stock),
    category: normalizeString(product.category),
    brand: normalizeString(product.brand),
    tags: Array.isArray(product.tags)
      ? product.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [],
    status: normalizeString(product.status),
    sku: normalizeString(product.sku),
    variants: Array.isArray(product.variants)
      ? product.variants.map((item) => normalizeProductVariant(item))
      : [],
    image_url: normalizeString(product.image_url),
    image_urls: Array.isArray(product.image_urls)
      ? product.image_urls.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
      : [],
    created_at: normalizeString(product.created_at),
    updated_at: normalizeString(product.updated_at),
  };
}

export function normalizeProductList(value: unknown): Product[] {
  return Array.isArray(value) ? value.map((item) => normalizeProduct(item)) : [];
}

function normalizeProductRatingBreakdown(value: unknown): ProductRatingBreakdown {
  const breakdown = isRecord(value) ? value : {};

  return {
    one: normalizeNumber(breakdown.one),
    two: normalizeNumber(breakdown.two),
    three: normalizeNumber(breakdown.three),
    four: normalizeNumber(breakdown.four),
    five: normalizeNumber(breakdown.five),
  };
}

export function normalizeProductReviewSummary(value: unknown): ProductReviewSummary {
  const summary = isRecord(value) ? value : {};

  return {
    average_rating: normalizeNumber(summary.average_rating),
    review_count: normalizeNumber(summary.review_count),
    rating_breakdown: normalizeProductRatingBreakdown(summary.rating_breakdown),
  };
}

export function normalizeProductReview(value: unknown): ProductReview {
  const review = isRecord(value) ? value : {};

  return {
    id: normalizeString(review.id),
    product_id: normalizeString(review.product_id),
    user_id: normalizeString(review.user_id),
    author_label: normalizeString(review.author_label),
    rating: normalizeNumber(review.rating),
    comment: normalizeString(review.comment),
    created_at: normalizeString(review.created_at),
    updated_at: normalizeString(review.updated_at),
  };
}

export function normalizeProductReviewList(value: unknown): ProductReviewList {
  const reviewList = isRecord(value) ? value : {};

  return {
    summary: normalizeProductReviewSummary(reviewList.summary),
    items: Array.isArray(reviewList.items)
      ? reviewList.items.map((item) => normalizeProductReview(item))
      : [],
  };
}

export function normalizeAddress(value: unknown): Address {
  const address = isRecord(value) ? value : {};

  return {
    id: normalizeString(address.id),
    user_id: normalizeString(address.user_id),
    recipient_name: normalizeString(address.recipient_name),
    phone: normalizeString(address.phone),
    street: normalizeString(address.street),
    ward: normalizeString(address.ward) || undefined,
    district: normalizeString(address.district),
    city: normalizeString(address.city),
    is_default: normalizeBoolean(address.is_default),
    created_at: normalizeString(address.created_at),
    updated_at: normalizeString(address.updated_at),
  };
}

export function normalizeAddressList(value: unknown): Address[] {
  return Array.isArray(value) ? value.map((item) => normalizeAddress(item)) : [];
}

export function normalizeShippingAddress(value: unknown): ShippingAddress | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    recipient_name: normalizeString(value.recipient_name),
    phone: normalizeString(value.phone),
    street: normalizeString(value.street),
    ward: normalizeString(value.ward) || undefined,
    district: normalizeString(value.district),
    city: normalizeString(value.city),
  };
}

export function normalizeCartItem(value: unknown): CartItem {
  const item = isRecord(value) ? value : {};

  return {
    product_id: normalizeString(item.product_id),
    name: normalizeString(item.name),
    price: normalizeNumber(item.price),
    quantity: normalizeNumber(item.quantity),
  };
}

export function normalizeCart(value: unknown): Cart {
  const cart = isRecord(value) ? value : {};
  const items = Array.isArray(cart.items) ? cart.items.map((item) => normalizeCartItem(item)) : [];

  return {
    user_id: normalizeString(cart.user_id),
    items,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  };
}

export function normalizeOrderItem(value: unknown): OrderItem {
  const item = isRecord(value) ? value : {};

  return {
    id: normalizeString(item.id),
    order_id: normalizeString(item.order_id),
    product_id: normalizeString(item.product_id),
    name: normalizeString(item.name),
    price: normalizeNumber(item.price),
    quantity: normalizeNumber(item.quantity),
  };
}

export function normalizeOrder(value: unknown): Order {
  const order = isRecord(value) ? value : {};

  return {
    id: normalizeString(order.id),
    user_id: normalizeString(order.user_id),
    status: normalizeString(order.status),
    subtotal_price: normalizeNumber(order.subtotal_price),
    discount_amount: normalizeNumber(order.discount_amount),
    coupon_code: normalizeString(order.coupon_code) || undefined,
    shipping_method: normalizeString(order.shipping_method),
    shipping_fee: normalizeNumber(order.shipping_fee),
    shipping_address: normalizeShippingAddress(order.shipping_address),
    total_price: normalizeNumber(order.total_price),
    items: Array.isArray(order.items) ? order.items.map((item) => normalizeOrderItem(item)) : [],
    created_at: normalizeString(order.created_at),
    updated_at: normalizeString(order.updated_at),
  };
}

export function normalizeOrderList(value: unknown): Order[] {
  return Array.isArray(value) ? value.map((item) => normalizeOrder(item)) : [];
}

export function normalizeOrderEvent(value: unknown): OrderEvent {
  const event = isRecord(value) ? value : {};

  return {
    id: normalizeString(event.id),
    order_id: normalizeString(event.order_id),
    type: normalizeString(event.type),
    status: normalizeString(event.status),
    actor_id: normalizeString(event.actor_id) || undefined,
    actor_role: normalizeString(event.actor_role) || undefined,
    message: normalizeString(event.message),
    created_at: normalizeString(event.created_at),
  };
}

export function normalizeOrderEventList(value: unknown): OrderEvent[] {
  return Array.isArray(value) ? value.map((item) => normalizeOrderEvent(item)) : [];
}

export function normalizeOrderPreview(value: unknown): OrderPreview {
  const preview = isRecord(value) ? value : {};

  return {
    subtotal_price: normalizeNumber(preview.subtotal_price),
    discount_amount: normalizeNumber(preview.discount_amount),
    coupon_code: normalizeString(preview.coupon_code) || undefined,
    coupon_description: normalizeString(preview.coupon_description) || undefined,
    shipping_method: normalizeString(preview.shipping_method),
    shipping_fee: normalizeNumber(preview.shipping_fee),
    total_price: normalizeNumber(preview.total_price),
  };
}

export function normalizePayment(value: unknown): Payment {
  const payment = isRecord(value) ? value : {};

  return {
    id: normalizeString(payment.id),
    order_id: normalizeString(payment.order_id),
    user_id: normalizeString(payment.user_id),
    order_total: normalizeNumber(payment.order_total),
    amount: normalizeNumber(payment.amount),
    status: normalizeString(payment.status),
    transaction_type: normalizeString(payment.transaction_type),
    reference_payment_id: normalizeString(payment.reference_payment_id) || undefined,
    payment_method: normalizeString(payment.payment_method),
    gateway_provider: normalizeString(payment.gateway_provider),
    gateway_transaction_id: normalizeString(payment.gateway_transaction_id) || undefined,
    gateway_order_id: normalizeString(payment.gateway_order_id) || undefined,
    checkout_url: normalizeString(payment.checkout_url) || undefined,
    signature_verified: normalizeBoolean(payment.signature_verified),
    failure_reason: normalizeString(payment.failure_reason) || undefined,
    net_paid_amount: typeof payment.net_paid_amount === "number" ? payment.net_paid_amount : undefined,
    outstanding_amount: typeof payment.outstanding_amount === "number" ? payment.outstanding_amount : undefined,
    created_at: normalizeString(payment.created_at),
    updated_at: normalizeString(payment.updated_at),
  };
}

export function normalizePaymentList(value: unknown): Payment[] {
  return Array.isArray(value) ? value.map((item) => normalizePayment(item)) : [];
}

export function normalizeUserProfile(value: unknown): UserProfile {
  const user = isRecord(value) ? value : {};

  return {
    id: normalizeString(user.id),
    email: normalizeString(user.email),
    phone: normalizeString(user.phone) || undefined,
    phone_verified: normalizeBoolean(user.phone_verified),
    phone_verified_at: normalizeString(user.phone_verified_at) || undefined,
    first_name: normalizeString(user.first_name),
    last_name: normalizeString(user.last_name),
    role: normalizeString(user.role),
    email_verified: normalizeBoolean(user.email_verified),
    created_at: normalizeString(user.created_at),
    updated_at: normalizeString(user.updated_at),
  };
}

export function normalizeUserProfileList(value: unknown): UserProfile[] {
  return Array.isArray(value) ? value.map((item) => normalizeUserProfile(item)) : [];
}

export function normalizeProfileAddressInput(value: unknown): ProfileAddressInput {
  const address = isRecord(value) ? value : {};

  return {
    recipient_name: normalizeString(address.recipient_name),
    phone: normalizeString(address.phone),
    street: normalizeString(address.street),
    ward: normalizeString(address.ward) || undefined,
    district: normalizeString(address.district),
    city: normalizeString(address.city),
  };
}

export function normalizePhoneVerificationChallenge(value: unknown): PhoneVerificationChallenge | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    verification_id: normalizeString(value.verification_id),
    phone: normalizeString(value.phone),
    phone_masked: normalizeString(value.phone_masked),
    status: normalizeString(value.status),
    expires_at: normalizeString(value.expires_at) || undefined,
    resend_available_at: normalizeString(value.resend_available_at) || undefined,
    expires_in_seconds: normalizeNumber(value.expires_in_seconds),
    resend_in_seconds: normalizeNumber(value.resend_in_seconds),
    max_attempts: normalizeNumber(value.max_attempts),
    remaining_attempts: normalizeNumber(value.remaining_attempts),
    verified_at: normalizeString(value.verified_at) || undefined,
  };
}

export function normalizeProductPopularity(value: unknown): ProductPopularity {
  const popularity = isRecord(value) ? value : {};

  return {
    product_id: normalizeString(popularity.product_id),
    quantity: normalizeNumber(popularity.quantity),
  };
}
