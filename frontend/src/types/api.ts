export type ApiMeta = {
  page: number;
  limit: number;
  total: number;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  error?: string;
  meta?: ApiMeta;
};

export type UserProfile = {
  id: string;
  email: string;
  phone?: string;
  first_name: string;
  last_name: string;
  role: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type AuthPayload = {
  token: string;
  user: UserProfile;
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

export type ProductVariant = {
  sku: string;
  label: string;
  size?: string;
  color?: string;
  price: number;
  stock: number;
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

export type Address = {
  id: string;
  user_id: string;
  recipient_name: string;
  phone: string;
  street: string;
  ward?: string;
  district: string;
  city: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type ShippingAddress = {
  recipient_name: string;
  phone: string;
  street: string;
  ward?: string;
  district: string;
  city: string;
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
  total_price: number;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
};

export type OrderPreview = {
  subtotal_price: number;
  discount_amount: number;
  coupon_code?: string;
  coupon_description?: string;
  shipping_method: string;
  shipping_fee: number;
  total_price: number;
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

export type Coupon = {
  id: string;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number;
  usage_limit: number;
  used_count: number;
  active: boolean;
  expires_at?: string;
  created_at: string;
  updated_at: string;
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
  signature_verified: boolean;
  failure_reason?: string;
  net_paid_amount?: number;
  outstanding_amount?: number;
  created_at: string;
  updated_at: string;
};

export type ProductPopularity = {
  product_id: string;
  quantity: number;
};

export type UploadedProductImages = {
  urls: string[];
};

export type AdminOrderTopProduct = {
  product_id: string;
  name: string;
  quantity: number;
  revenue: number;
};

export type AdminOrderStatusBreakdown = {
  status: string;
  orders: number;
  revenue: number;
};

export type AdminOrderReport = {
  window_days: number;
  total_revenue: number;
  order_count: number;
  cancelled_count: number;
  average_order_value: number;
  top_products: AdminOrderTopProduct[];
  status_breakdown: AdminOrderStatusBreakdown[];
};
