export type ShopFootwearTypeOption = {
  label: string;
  active?: boolean;
};

export type ShopFootwearSizeOption = {
  label: string;
  active?: boolean;
};

export type ShopFootwearMaterialOption = {
  label: string;
  active?: boolean;
};

export type ShopFootwearProductBadge = {
  label: string;
  tone: "surface" | "primary";
};

export type ShopFootwearProduct = {
  id: string;
  name: string;
  material: string;
  price: string;
  imageUrl: string;
  imageAlt: string;
  badge?: ShopFootwearProductBadge;
  offset?: boolean;
};

export const shopFootwearHero = {
  label: "The Digital Atelier",
  title: "Footwear Atelier",
  description:
    "A curated collection of sculptural silhouettes, handcrafted from the finest Italian hides. Where traditional craftsmanship meets modern architectural precision.",
  imageUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAFXvDME4hl86EBAExrs0TPuPyrDnhtwEb8MCDCvjzu2OS-kjWnUF7XkqwYs0MGf5WGZS6B5xPKLv0OXCG5ZrDjkm-McNkALLC0DCYp5LC9beGhY0SnzFUMFF998AElRWMoxze_NVDcZ1jJ4qerfPiE1xI5Xjc0Euy-lzfbdQzjbDW9gtsemGrCxPBq4MDAxVn_PdqcdHWaZ05cl7EMLinkvr6U9D8RGxe-UFtVaee5Q6n-Ohev-vr9h8DwExyawlWEZa9kUKDqsxlQ",
  imageAlt:
    "Close-up of premium leather shoemaking tools and high-end footwear materials in a brightly lit artisan workshop"
};

export const shopFootwearTypeFilters: ShopFootwearTypeOption[] = [
  { label: "Boots", active: true },
  { label: "Sneakers" },
  { label: "Loafers" },
  { label: "Sandals" }
];

export const shopFootwearSizeFilters: ShopFootwearSizeOption[] = [
  { label: "40" },
  { label: "41" },
  { label: "42" },
  { label: "43", active: true },
  { label: "44" },
  { label: "45" }
];

export const shopFootwearMaterialFilters: ShopFootwearMaterialOption[] = [
  { label: "Calfskin" },
  { label: "Suede" },
  { label: "Grain Leather" }
];

export const shopFootwearProducts: ShopFootwearProduct[] = [
  {
    id: "atelier-low-sneaker",
    name: "Atelier Low Sneaker",
    material: "Smooth Italian Calfskin",
    price: "$340",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAMYKBjYQhfEPiX1rrzGJqP-bZ3N-za3aIYrq4ZJ7iHUOBBELUJUpvBk3Ms1bHaAXBuEZwTIczKGpjLz2AbAXSyAma0h_FRPa4MA_RgE9EO-SCavieX4XPDLcnuloZs8tAGD5FGHlcBtSszlVWYz-FA-hca0gi-xkAC4k_vrZmULdCAPQNXUhSbE3wrhj8_XgthXU6Aso4ltg4ME3nEgOsgEaBDUB6hKvQ_Ere_31vsZ98zkTq0zGrgjNqUJHCDPBUQPmqG9Q702KKw",
    imageAlt:
      "Minimalist premium white leather sneakers on a neutral architectural background with soft shadows",
    badge: { label: "New Arrival", tone: "surface" }
  },
  {
    id: "chelsea-field-boot",
    name: "Chelsea Field Boot",
    material: "Waxed Roughout Leather",
    price: "$495",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD5KVhgLop51bisay_zrsW8YVtKdD2et-udRx64dbQtp0xYp4CE38R94dLqJO460aolSqy9UdPhfvdjSyjzz7Bbh4MOeBkHbehqlMCTvPNv4PLXn3wFu6XqNIM_5UyUXX71NRni2ntQt4twbRrDvUPUi5cDXb-939ibHoOeSHMsDghYNOy7kZp5gd14kjIf6WUveYq0O9RFsuf5oY9RK1U9jhhlcJ_HJPXAwSBdNK2y67FH0n0MdcVNPoEwpIxvSAkUOZdh9YgdL7FA",
    imageAlt:
      "Elegant dark brown leather chelsea boots with a polished finish and refined silhouette",
    badge: { label: "Handcrafted", tone: "primary" },
    offset: true
  },
  {
    id: "classic-penny-loafer",
    name: "Classic Penny Loafer",
    material: "Pebbled Grain Leather",
    price: "$420",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAAhJretAaN4nn0hwa-S3geRVjspqi5Iysp4o9wJ6Umsp05BfiGqmXjoyIkxI-iO9bJQHh6aFW1ByRoH4hP6tAQ1ifpRkG88XfFjHc7Tu8bEt310kgkBdS8l4wXyGN477geZFXoBXA7tpLWEx-ySFm69csgvDnFB-DbTmu1Va59aScYOFNkVt4WimRi19ZpDNf2YvhkDC8ETmf7ZpivWgg0fG1e-5cX386ZaOUDjcQ35GqrXeknlGJ-ig73LknVdiR_VbQ_rfBrjtto",
    imageAlt:
      "Classic black leather loafers with a modern minimalist buckle and slim profile"
  },
  {
    id: "moc-toe-service-boot",
    name: "Moc Toe Service Boot",
    material: "English Bridle Leather",
    price: "$560",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD4G3y0ZNdrqZS0ATojfSYa5t42Vrrx476FUX5qzvdCm_CCtF0C5yrINsDw4_G71jrBcMmaoueccHcMXO1xws91KQPeOyvLKzB9nAJZ70r7sO7YUn_u5DMqM93aUESLHoGVqBzejgzYA6j31SfDmrQl3IeBeL-xTBwhgq4AG_zSgROd0lwpbM9okRm26Hm2PbSk7bsL6aFYLo561VTjxiVDA_m28FuAt2wvBZpwLQNP23z7cESJyuNoMgdIyfHRBsZerL9BQbZ5D2p1",
    imageAlt:
      "High-top handcrafted leather service boots in tobacco tan color with premium hardware"
  }
];

export const shopFootwearHighlight = {
  title: "The Heritage Series",
  description:
    "Each pair is lasted by hand in our Marche workshop, requiring over 120 unique steps of production.",
  cta: "Discover Craft",
  imageUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCZ-APurl8_BiFwk3y7F_FQ6yAaUu7Zw5a3SwI1fKprr5Hl-pEJ7RvuePMticspNlEb5sfivV0hr3ziS5sz0bG3RDIHQNbSSzVxf4yy3SHrI1HYxt840txIaJXkqTxhDPEGqQSpKgpzORrmx7_dH36fEu9yV1wBLd4EFXPI3P9HF88KpxwOrHRf3Eo3vbpyF_6SUQioP80y8xLrbwF-t0TcylSeDTua3_2ycuM0U1UJFevlpmB_l93PUKlm0qiZoLJ5S6tUaoLL6bvQ",
  imageAlt:
    "Abstract editorial shot of fine shoe laces and leather texture in high contrast lighting"
};

export const shopFootwearQuote = {
  text: "Luxury is not the absence of imperfection, but the presence of character.",
  author: "Master Shoemaker, ND Atelier"
};
