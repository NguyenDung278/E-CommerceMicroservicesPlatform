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
  first_name: string;
  last_name: string;
  role: string;
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
  image_url: string;
  created_at: string;
  updated_at: string;
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
  total_price: number;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  order_id: string;
  user_id: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  updated_at: string;
};
