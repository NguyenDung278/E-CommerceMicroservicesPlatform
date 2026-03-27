export type Department =
  | "men"
  | "women"
  | "footwear"
  | "accessories"
  | "living";

export type Availability = "in-stock" | "low-stock" | "sold-out" | "pre-order";

export type CatalogPreviewState = "live" | "loading" | "error";

export type CatalogSortMode =
  | "featured"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating";

export type ProductColor = {
  name: string;
  swatch: string;
};

export type ProductSize = {
  label: string;
  inStock: boolean;
};

export type ProductReview = {
  id: string;
  author: string;
  role: string;
  rating: number;
  quote: string;
  verified: boolean;
  createdAt: string;
};

export type ProductSpec = {
  label: string;
  value: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  shortName?: string;
  subtitle: string;
  description: string;
  story: string;
  department: Department;
  category: string;
  collection: string;
  brand: string;
  image: string;
  hoverImage?: string;
  gallery: string[];
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviewCount: number;
  availability: Availability;
  inventory: number;
  featured: boolean;
  newArrival: boolean;
  colors: ProductColor[];
  sizes: ProductSize[];
  tags: string[];
  badges: string[];
  materials: string[];
  specs: ProductSpec[];
  relatedSlugs: string[];
  sortOrder: number;
};

export type CartLine = {
  productId: string;
  quantity: number;
  selectedColor: string;
  selectedSize: string;
};

export type ShippingAddress = {
  fullName: string;
  email: string;
  streetAddress: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
};

export type PlacedOrder = {
  orderNumber: string;
  placedAt: string;
  etaLabel: string;
  email: string;
  shippingAddress: ShippingAddress;
  lines: CartLine[];
};

export type NavItem = {
  label: string;
  href: string;
  department?: Department;
};
