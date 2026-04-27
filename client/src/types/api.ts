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

export type AuthPayload = {
  token: string;
  refresh_token: string;
  user: UserProfile;
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

export type StorefrontCategoryPageData = {
  category: StorefrontCategory;
  featured_products: StorefrontFeaturedProduct[];
};

export type StorefrontHomeData = {
  categories: StorefrontCategory[];
  category_pages: StorefrontCategoryPageData[];
};

export type ProductSearchAssist = {
  query: string;
  resolved_query: string;
  result_count: number;
  suggestions: Array<{
    value: string;
    kind: string;
    match_count: number;
  }>;
};

export type ProductReviewSummary = {
  average_rating: number;
  review_count: number;
};

export type ProductReview = {
  id: string;
  product_id: string;
  author_label: string;
  rating: number;
  comment: string;
  created_at: string;
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
  total_price: number;
  items: OrderItem[];
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
  payment_method: string;
  gateway_provider: string;
  checkout_url?: string;
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
