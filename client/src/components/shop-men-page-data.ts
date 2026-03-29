export type ShopMenNavItem = {
  label: string;
  href: string;
  active?: boolean;
};

export type ShopMenFilterGroup = {
  title: string;
  type: "list" | "sizes" | "price";
  options?: Array<{
    label: string;
    active?: boolean;
  }>;
  minLabel?: string;
  maxLabel?: string;
  valuePercent?: number;
};

export type ShopMenProduct = {
  id: string;
  name: string;
  material: string;
  price: string;
  imageUrl: string;
  badge?: string;
  offset?: boolean;
};

export const shopMenNavItems: ShopMenNavItem[] = [
  { label: "Archive", href: "/archive" },
  { label: "Men", href: "/categories/Shop%20Men", active: true },
  { label: "Women", href: "/categories/Shop%20Women" },
  { label: "Footwear", href: "/categories/Footwear" },
  { label: "Accessories", href: "/categories/Accessories" },
];

export const shopMenFilterGroups: ShopMenFilterGroup[] = [
  {
    title: "Category",
    type: "list",
    options: [
      { label: "Shirts", active: true },
      { label: "Outerwear" },
      { label: "Trousers" },
      { label: "Knitwear" },
    ],
  },
  {
    title: "Size",
    type: "sizes",
    options: [
      { label: "S" },
      { label: "M", active: true },
      { label: "L" },
      { label: "XL" },
    ],
  },
  {
    title: "Price Range",
    type: "price",
    minLabel: "$150",
    maxLabel: "$2,500",
    valuePercent: 46,
  },
];

export const shopMenProducts: ShopMenProduct[] = [
  {
    id: "sculpted-linen-shirt",
    name: "Sculpted Linen Shirt",
    material: "Italian Linen Blend",
    price: "$420",
    badge: "New Arrival",
    imageUrl:
      "https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "structured-atelier-jacket",
    name: "Structured Atelier Jacket",
    material: "100% Merino Wool",
    price: "$1,250",
    badge: "Limited Edition",
    offset: true,
    imageUrl:
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "modern-drape-trousers",
    name: "Modern Drape Trousers",
    material: "Fine Serge Cotton",
    price: "$380",
    imageUrl:
      "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "atelier-knit-polo",
    name: "Atelier Knit Polo",
    material: "Sea Island Cotton",
    price: "$290",
    badge: "New Arrival",
    imageUrl:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "obsidian-overcoat",
    name: "The Obsidian Overcoat",
    material: "Cashmere Blend",
    price: "$1,890",
    offset: true,
    imageUrl:
      "https://images.unsplash.com/photo-1542272454315-2d9c04865f02?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "relaxed-cargo-trouser",
    name: "Relaxed Cargo Trouser",
    material: "Brushed Twill",
    price: "$340",
    imageUrl:
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=1200&q=80",
  },
];

export const shopMenHero = {
  badge: "DEV ONLY",
  title: "Men’s Atelier",
  description: "An architectural study in silhouette and structure. Crafted for the modern artisan.",
  imageUrl:
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=2000&q=80",
};

export const shopMenFooterLinks = [
  { label: "Journal", href: "/journal" },
  { label: "Sustainability", href: "/sustainability" },
  { label: "Shipping", href: "/shipping" },
  { label: "Returns", href: "/returns" },
  { label: "Privacy", href: "/privacy" },
];
