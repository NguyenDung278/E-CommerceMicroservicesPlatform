export type ApiMeta = {
  page?: number;
  limit?: number;
  total?: number;
  next_cursor?: string;
  has_next?: boolean;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  error?: string | null;
  meta?: ApiMeta | null;
};

export type UserProfile = {
  id: string;
  email: string;
  avatar_url?: string;
  phone?: string;
  phone_verified: boolean;
  first_name: string;
  last_name: string;
  role: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type PhoneVerificationStatus = {
  verification_id: string;
  phone: string;
  phone_masked: string;
  status: string;
  expires_at?: string;
  resend_available_at?: string;
  expires_in_seconds: number;
  resend_in_seconds: number;
  max_attempts: number;
  remaining_attempts: number;
  verified_at?: string | null;
};

export type EmailVerificationStatus = {
  verification_id: string;
  email: string;
  email_masked: string;
  status: string;
  expires_at?: string;
  resend_available_at?: string;
  expires_in_seconds: number;
  resend_in_seconds: number;
  max_attempts: number;
  remaining_attempts: number;
  verified_at?: string | null;
};

export type UploadAvatarResponse = {
  avatar_url?: string;
  user?: UserProfile;
};

export type AuthPayload = {
  token: string;
  refresh_token: string;
  user: UserProfile;
};

export type WishlistItem = {
  user_id: string;
  product_id: string;
  baseline_price?: number;
  baseline_stock?: number;
  created_at: string;
  updated_at: string;
};

export type WishlistAlert = {
  product_id: string;
  product_name?: string;
  kind: "back_in_stock" | "price_drop" | string;
  baseline_price?: number;
  current_price?: number;
  baseline_stock?: number;
  current_stock?: number;
  detected_at: string;
};

export type NotificationPreference = {
  user_id: string;
  topic: string;
  enabled: boolean;
  updated_at: string;
};

export type NotificationInboxItem = {
  id: string;
  user_id: string;
  topic: string;
  routing_key: string;
  delivery_status: string;
  visible_to_user: boolean;
  attempt_count?: number;
  last_error?: string;
  next_retry_at?: string;
  title: string;
  message: string;
  action_href?: string;
  action_label?: string;
  order_id?: string;
  payment_id?: string;
  return_id?: string;
  created_at: string;
  read_at?: string;
};

export type MarkNotificationReadResult = {
  updated_count: number;
};

export type ProductVariant = {
  sku: string;
  label: string;
  size?: string;
  color?: string;
  price: number;
  stock: number;
  image_urls?: string[];
  badge?: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  brand: string;
  tags: string[];
  status: string;
  sku: string;
  variants: ProductVariant[];
  image_url: string;
  image_urls: string[];
  created_at: string;
  updated_at: string;
};

export type StorefrontCategory = {
  slug: string;
  display_name: string;
  nav_label: string;
  status: string;
  hero?: unknown;
  filter_config?: unknown;
  seo?: unknown;
  aliases?: string[];
  created_at?: string;
  updated_at?: string;
};

export type StorefrontProduct = Product & {
  external_id?: string;
  category_slug?: string;
  material?: string;
  merchandising_rank?: number;
};

export type StorefrontFeaturedProduct = {
  id: string;
  product_external_id: string;
  category_slug: string;
  position: number;
  product: StorefrontProduct;
};

export type StorefrontEditorialSection = {
  id: string;
  category_slug: string;
  section_type: string;
  position: number;
  payload?: unknown;
  published: boolean;
};

export type StorefrontCategoryPageData = {
  category: StorefrontCategory;
  sections?: StorefrontEditorialSection[];
  featured_products: StorefrontFeaturedProduct[];
};

export type StorefrontHomeData = {
  categories: StorefrontCategory[];
  category_pages: StorefrontCategoryPageData[];
};

export type ProductSearchAssist = {
  query: string;
  resolved_query: string;
  applied_synonyms?: string[];
  result_count: number;
  suggestions: Array<{
    value: string;
    kind: string;
    match_count: number;
  }>;
  facets?: Array<{
    key: string;
    label: string;
    values: Array<{
      value: string;
      count: number;
    }>;
  }>;
  sort_options?: Array<{
    value: string;
    label: string;
  }>;
};

export type ProductPopularity = {
  product_id: string;
  quantity: number;
};

export type ProductReviewSummary = {
  average_rating: number;
  review_count: number;
  rating_breakdown?: {
    one: number;
    two: number;
    three: number;
    four: number;
    five: number;
  };
};

export type ProductReview = {
  id: string;
  product_id: string;
  user_id?: string;
  author_label: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at?: string;
};

export type ProductReviewList = {
  summary: ProductReviewSummary;
  items: ProductReview[];
};

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
};

export type Cart = {
  user_id: string;
  items: CartItem[];
  total: number;
};

export type ShippingAddress = {
  recipient_name: string;
  phone: string;
  location: string;
};

export type ShippingOption = {
  method: string;
  label: string;
  description?: string;
  fee: number;
  eta_min_days: number;
  eta_max_days: number;
  eta_label: string;
  delivery_promise: string;
};

export type CouponWalletItem = {
  code: string;
  description: string;
  discount_type: "fixed" | "percentage" | string;
  discount_value: number;
  min_order_amount: number;
  expires_at?: string;
  eligible: boolean;
  ineligible_reason?: string;
  estimated_discount: number;
  remaining_usage_hint?: number;
};

export type OrderItemRequest = {
  product_id: string;
  name?: string;
  price?: number;
  quantity: number;
};

export type CreateOrderRequest = {
  items: OrderItemRequest[];
  coupon_code?: string;
  shipping_method?: string;
  shipping_address?: ShippingAddress;
};

export type OrderPreview = {
  subtotal_price: number;
  discount_amount: number;
  coupon_code?: string;
  coupon_description?: string;
  shipping_method: string;
  shipping_fee: number;
  eta_label?: string;
  delivery_promise?: string;
  supported_shipping_methods: ShippingOption[];
  total_price: number;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
};

export type Order = {
  id: string;
  user_id: string;
  status: string;
  subtotal_price: number;
  discount_amount: number;
  coupon_code?: string;
  shipping_method: string;
  shipping_fee: number;
  shipping_address?: ShippingAddress;
  reservation_expires_at?: string;
  reservation_allocated_at?: string;
  total_price: number;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
};

export type OrderEvent = {
  id: string;
  order_id: string;
  type: string;
  status: string;
  actor_id?: string;
  actor_role?: string;
  message: string;
  created_at: string;
};

export type ShipmentTracking = {
  id: string;
  order_id: string;
  carrier: string;
  tracking_number: string;
  tracking_url?: string;
  status: string;
  estimated_delivery_at?: string;
  last_checked_at?: string;
  created_at: string;
  updated_at: string;
};

export type ReturnEligibilityItem = {
  order_item_id: string;
  product_id: string;
  product_name: string;
  ordered_quantity: number;
  already_requested_quantity: number;
  remaining_quantity: number;
  eligible: boolean;
  reason?: string;
};

export type ReturnEligibilitySnapshot = {
  order_id: string;
  order_status: string;
  eligible: boolean;
  reason?: string;
  return_window_days: number;
  return_window_started_at?: string;
  return_window_expires_at?: string;
  items: ReturnEligibilityItem[];
};

export type ReturnItem = {
  id: string;
  return_id: string;
  order_item_id: string;
  product_id: string;
  quantity: number;
  reason?: string;
  created_at: string;
  updated_at: string;
};

export type ReturnEvent = {
  id: string;
  return_id: string;
  status: string;
  actor_id?: string;
  actor_role?: string;
  message: string;
  created_at: string;
};

export type ReturnEvidence = {
  id: string;
  return_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  url: string;
  uploaded_by?: string;
  uploaded_by_role?: string;
  created_at: string;
};

export type ReturnRequest = {
  id: string;
  order_id: string;
  user_id: string;
  user_email?: string;
  status: string;
  reason: string;
  items: ReturnItem[];
  events?: ReturnEvent[];
  evidence?: ReturnEvidence[];
  refund_amount?: number;
  refund_charge_payment_id?: string;
  refund_payment_id?: string;
  refund_last_error?: string;
  refund_attempt_count?: number;
  refund_requested_at?: string;
  refund_completed_at?: string;
  refund_next_retry_at?: string;
  created_at: string;
  updated_at: string;
};

export type CreateReturnRequest = {
  reason: string;
  items: Array<{
    order_item_id: string;
    quantity: number;
    reason?: string;
  }>;
};

export type PaymentSummary = Payment;

export type UserOrderSummary = {
  orders: Order[];
  payments_by_order: Record<string, PaymentSummary[]>;
};

export type Payment = {
  id: string;
  order_id: string;
  user_id: string;
  order_total: number;
  amount: number;
  status: string;
  transaction_type: string;
  reference_payment_id?: string;
  payment_method: string;
  gateway_provider: string;
  gateway_transaction_id?: string;
  gateway_order_id?: string;
  checkout_url?: string;
  signature_verified?: boolean;
  failure_reason?: string;
  net_paid_amount?: number;
  outstanding_amount?: number;
  created_at: string;
  updated_at: string;
};

export type Address = {
  id: string;
  user_id: string;
  recipient_name: string;
  phone: string;
  location: string;
  is_default: boolean;
};
