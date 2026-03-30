export type ShopWomenCategoryOption = {
  label: string;
  count: string;
  active?: boolean;
};

export type ShopWomenSizeOption = {
  label: string;
  active?: boolean;
};

export type ShopWomenPaletteOption = {
  label: string;
  color: string;
  active?: boolean;
  light?: boolean;
};

export type ShopWomenProductBadge = {
  label: string;
  tone: "soft";
};

export type ShopWomenProduct = {
  id: string;
  name: string;
  categoryLabel: string;
  price: string;
  imageUrl: string;
  imageAlt: string;
  badge?: ShopWomenProductBadge;
  showQuickAdd?: boolean;
  offset?: "up" | "down";
};

export const shopWomenHero = {
  label: "Dev Only",
  title: "The Women’s Atelier",
  description:
    "A curated selection of architectural silhouettes and natural textiles, designed for the modern form.",
  imageUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCCHjHHNBD0bZoSfUrXMIUsusvSJpfmxcJRzVyGEWriuKDCynB8NOcLil0MHJfUCfgjmGv_IMPAfbmEm73hz3s6Y6ycMQrKq1qnMzNHz4QbDczvsSfdf8SaL9vw3qoSEt36Xm52OFG4ej1BLs2XxqsJW_tPT1C2xruIyndF6i4KCKATXFKExblf5UqEURDlAYRnWNDYbLXe8GGoCndX4q2IeRKAuk6Etam3vFkW85HI4vZvrHKCLYN63hA-DGdTKTpY9k-VBO3aY4le",
  imageAlt:
    "Close-up of ethereal cream-colored silk fabric draping elegantly in a sun-drenched minimalist atelier with soft morning shadows"
};

export const shopWomenCategoryFilters: ShopWomenCategoryOption[] = [
  { label: "Dresses", count: "12", active: true },
  { label: "Tops", count: "24" },
  { label: "Bottoms", count: "18" },
  { label: "Outerwear", count: "09" }
];

export const shopWomenSizeFilters: ShopWomenSizeOption[] = [
  { label: "XS" },
  { label: "S", active: true },
  { label: "M" },
  { label: "L" },
  { label: "XL" }
];

export const shopWomenPaletteFilters: ShopWomenPaletteOption[] = [
  { label: "Forest", color: "#061b0e", active: true },
  { label: "Cream", color: "#f5f3ee", light: true },
  { label: "Hearth", color: "#320900" },
  { label: "Obsidian", color: "#1b1c19" }
];

export const shopWomenProducts: ShopWomenProduct[] = [
  {
    id: "ethereal-silk-slip",
    name: "Ethereal Silk Slip",
    categoryLabel: "New Arrival",
    price: "$340",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA2sL_3eVTxv8pTPhQFFFpSQH6Kaq9or00Ox__PprWsxnH4iFcdyvkF6yE_uLy_crNRWln5sUDsqQmSo-iayh_0MyCYYTR20XSGjWAB-uNe6duE69pSu714RVSt74tQMEIF3fuTduw02xllANi1JDAtn12UeUh9ljLf8hz3xi6jPfnSdYWCX7w9y3IwSDyovmYmtsxb0x9P-3bKU5qLNiMw7cc4_t2zNEpT8QLPRQLTFIXGR2WRSQbgpFitN5ZgjO-BIsY_4Wyg7jRS",
    imageAlt:
      "Model wearing a flowing ethereal silk slip dress in a warm cream color standing in a studio with soft natural light",
    showQuickAdd: true
  },
  {
    id: "architectural-overcoat",
    name: "Architectural Overcoat",
    categoryLabel: "Outerwear",
    price: "$1,250",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBmKXEwtGPg000dRd0DYpkc78_z_0z7Q60H3fju2rnkDAllnKGSFzesSqKvn2OqncI_k-QRIvUyfVSm75I-UKw3DhxiM5eOINn4C-vJnvj2z8uKIL2AqGnXgvmqeYEEzJ5-il3zT3BTGt9iPabLxhcPbK9AwTzCM3Z9Fo3vrhfReTlHCTZ3EIgs7_JxhOFfmrNerCamtXr0QKPKlok1p5W71S8CFoXMlgrk9yrqe55hyi8oG24OwLIfOD6sAGZDuAtdrYmvQ0QD-hzg",
    imageAlt:
      "High-end architectural overcoat in deep forest green tailored perfectly with sharp lines and textured wool",
    badge: { label: "Limited", tone: "soft" }
  },
  {
    id: "cloud-cashmere-crew",
    name: "Cloud Cashmere Crew",
    categoryLabel: "Knitwear",
    price: "$280",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBEKFEZ7Xk7Fyqc9Uf8Rr7JfhPIghhY7j0HO6bqSglckdRAUU1XFK1Vy_uPXAbpLqczXmCH41FFfT4QIgBtt7oBHhaEojRqYoMhEeW0zN9yDlgFxnnAhZfa_FjmfnZNakXUp-HAT6D2gb_BUeHA5TXBmMVsObd_AHQfOwPuMZTKrAqSkXnJe60KUnlOWajJ6btQ5zyNadwls33tVZNcDlHyJ8_EUlUAhHRtQ90ZhEzMNN5Mzjf_Hr7Onn7MZF-hkz45XkPrdm6pngSw",
    imageAlt:
      "Soft cloud cashmere crew neck sweater in a warm stone grey color resting on a wooden chair in soft lighting"
  },
  {
    id: "sculptural-pleated-skirt",
    name: "Sculptural Pleated Skirt",
    categoryLabel: "Bottoms",
    price: "$490",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAULIeOGtZd7vXZH0gSJHWiv3w1w4d6Tz7E7Y55Pp0wpbrudgRPkQEUxLNJ7z1iX2ofjNS4KSwbIFdzRgJR2rZEzslEi02TskRTUycOtweLNiBcTRv0RAiCUncTPXaXvHGzovAfwglQIxRlDavgkG0kp9z1__77ZtFulQa4AVlvR_muVhFSILTRpDDYMIgzrzsCEPjKJNyVc0k_NtV_qrK021aTU5RlI_Mg4TBu8JIzJLGkLHTEGfvWBezAYGbi6wNp_bgFRdeYEwST",
    imageAlt:
      "Woman wearing a sculptural pleated skirt in deep charcoal grey walking through a brutalist concrete building",
    offset: "up"
  },
  {
    id: "hearth-tapered-pant",
    name: "Hearth Tapered Pant",
    categoryLabel: "Bottoms",
    price: "$320",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAaOoy5mPR6kERrz2pjB05mC0JlxtRtsf2hinDbaZYFD7RKSJI_OTZn_SVo1D7JP85uSvsIZaQ5ebu77UNrwEjYJZhP6gfcKLOHkl-z5NFjTzCwUsmsvv1WbILS5HtKtmz6D5YPmeIASNcfDev_nsQcB5Odi4O5svKDuTAkJyHAlgm2j2VUKiwX_XzxOMsMjnnzRdyJcj-olztbGq4uYqe6FRhYp04lXvSqa4dkOjD9RZ1tB8UYpCw_Jj4C-Vwk4eokTl5ETem6rnWz",
    imageAlt:
      "Detail shot of high-end trousers with refined stitching in a soft terracotta clay color"
  },
  {
    id: "atelier-formal-blazer",
    name: "Atelier Formal Blazer",
    categoryLabel: "Outerwear",
    price: "$850",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCLcoGr7KP32O8-hGiy_R2XgyAroX9NifHN9bp-cIa4MHixZs87jXhzocVyCNAS3MnosR5YMFpf4FISO7lLR-kKnFLGlEzEpOj83h0kbOwK6Pnh34L5HRcDXs-mn4MSca3ZHmi1j5JFvCLSAtZqcx49HaXw-0ig_4UGpNNyJn-jbSUufnz2HoBnnsHCFAoTAfl496e8aw7KajnM3HNoABdqEW2LpHzMvPXX5bXFHa5HQuxPuycHrYw8i-08kA3CEEThIkKU4-Ah21WT",
    imageAlt:
      "Model wearing a structured minimal blazer in forest green sitting on an antique velvet chair",
    offset: "down"
  }
];

export const shopWomenEditorial = {
  label: "Our Mission",
  title: "Quiet Luxury,\nDefined by Purpose.",
  description:
    "ND Shop stands at the intersection of traditional couture and digital efficiency. We believe in pieces that last decades, not seasons.",
  featureTitle: "The Craftsmanship",
  featureDescription:
    "Every piece is hand-finished in our northern studio, prioritizing ethical labor and carbon-neutral distribution.",
  featureCta: "Read the Story",
  featureImageUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCLsY0s2ZGLvPOl_WOwZoRpU02WbZGuHEO8UYQbV-QWMzzX129rq4Z6wr0Of9_rO5ILe2ORGFxzdGgYxdkYQuGX8LuAiJFBn-AWJ_STJTV3_Qaw1EYkxhfRFuy2Smn4yO_ovskCl5pppFCtSalHvg7ma1t9y4vciyHBl-hT5g_UQz_FOFrLG2NslH8KuNQiQDfwe7niMFOYjLd2kzxg__y2CRqR6UmCP7dbDRT-sBxMV1FcW2COldHDSQ6HCHyiqNEFS1cu9JEhcRAA",
  featureImageAlt:
    "Wide shot of a fashion atelier with large windows, rolls of fine fabric, and a dress form with a partially constructed garment"
};
