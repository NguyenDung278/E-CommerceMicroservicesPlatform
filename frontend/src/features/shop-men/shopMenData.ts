export type ShopMenNavItem = {
  label: string;
  to: string;
  active?: boolean;
};

export type ShopMenFilterOption = {
  label: string;
  active?: boolean;
};

export type ShopMenProductBadge = {
  label: string;
  tone: "forest" | "accent";
};

export type ShopMenProduct = {
  id: string;
  name: string;
  material: string;
  price: string;
  imageUrl: string;
  imageAlt: string;
  badge?: ShopMenProductBadge;
  offset?: boolean;
};

export const shopMenNavItems: ShopMenNavItem[] = [
  { label: "Archive", to: "/products" },
  { label: "Men", to: `/categories/${encodeURIComponent("Shop Men")}`, active: true },
  { label: "Women", to: `/categories/${encodeURIComponent("Shop Women")}` },
  { label: "Footwear", to: `/categories/${encodeURIComponent("Footwear")}` },
  { label: "Accessories", to: `/categories/${encodeURIComponent("Accessories")}` }
];

export const shopMenCategoryFilters: ShopMenFilterOption[] = [
  { label: "Shirts", active: true },
  { label: "Outerwear" },
  { label: "Trousers" },
  { label: "Knitwear" }
];

export const shopMenSizeFilters: ShopMenFilterOption[] = [
  { label: "S" },
  { label: "M", active: true },
  { label: "L" },
  { label: "XL" }
];

export const shopMenProducts: ShopMenProduct[] = [
  {
    id: "sculpted-linen-shirt",
    name: "Sculpted Linen Shirt",
    material: "Italian Linen Blend",
    price: "$420",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBRTlahnsv0f7ya3xU5YTERBeygNv3B_6MEExHsUzTI3uGv3gn9RVVaVkXFHJAQIYeO-NnQ-n51wqkjA-oml_uoLI96mxp1piJxtPHA5ofpE_9tSdHTMa8lNfjCgdbUOSRi__Y4J8VFSz5HhI5ZB9C5Vl5zl-6FxNxhAYwEDNV_XOP2dGsj5rTUtGDd1a59qGSue1hdS28wAOq4_SpG152HGpLir9kJsPtGA9trmPt5raubxkNMY1AI1cI7Qs5-pnKuSFT_JrLZrEaz",
    imageAlt:
      "Sophisticated cream tailored linen shirt hanging against a minimalist planner wall with morning shadows",
    badge: { label: "New Arrival", tone: "forest" }
  },
  {
    id: "structured-atelier-jacket",
    name: "Structured Atelier Jacket",
    material: "100% Merino Wool",
    price: "$1,250",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA004mNLReNQb9OI2U6JwpX4idr5HiAL2OAqj-X2r60qRDaMIYLE7YAWWdvJ6_uvkh1jgDweWN2QRC0Z6CnAXNS54x6M_Qkf8uPtTr4G6Cl5-Y5z8iuGvbIv1u_DCawCRbkf01JSFMi_iZ2APFb_m56yIPq8-_Ap7HY-QbhgAL2tc-tsE4VsnyibszwQjgYBz28AGgGUIIQ7EDmY1bXGdkXyNQI991VG2ouIlVK-wOCqK_Lq8GNj4h27eldl1LjnR6Wt903BlKnHCVn",
    imageAlt:
      "High-end charcoal structured wool jacket detail showing the lapel and precise stitching on a dark background",
    badge: { label: "Limited Edition", tone: "accent" }
  },
  {
    id: "modern-drape-trousers",
    name: "Modern Drape Trousers",
    material: "Fine Serge Cotton",
    price: "$380",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBXRSWOWcHtCNyaMDYLCJzvRD_aYObkVBkIHPoz_HZOOuihWxPKo82MAX7anUmfBqHwOgx_6YthGokOn-aqEtAkMya3di9RNTlqqA2-zqT6x85Yh0CGWy5_gOTjOOMYxnRJ7B8A9ihZaMR-PzIAILb7T5rSMUCiZ-3CZRTX_u3XxJpOlXlYjWEZj4aFLaV_mamuWkKjkhTxSRpw7LyICx9lPITcKUuGOxJ0NkpKweDI4rMjqFkSSGZJssErigmmpbKq5Z6kLPVUehXg",
    imageAlt:
      "Pair of folded olive green trousers with sharp creases lying on a light wood surface with natural sunlight"
  },
  {
    id: "atelier-knit-polo",
    name: "Atelier Knit Polo",
    material: "Sea Island Cotton",
    price: "$290",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDBowt2AR0QGkZ_teHLK0qG2iUl8fGSUuNTrZHreU_s95xtmrbnCTB8LYOShnHaraaNDqoUnziBnVe2Rh6OAlJpU9ZSpF84L0-k23aokXc6aJdWswRdyGowycFswnENPgO9tfnUyUaMa2VjW8lGJYkmhPbnJhSE0zC0BdoSTdae8pmGnQwaAXzVlJJRhWYysiO1yf2n_lREj8nVxarkGub1OLnfLI4QrhAiAGV-AZTWnZg1MCqdpNi1pBSjb6RIPFAzXw0h_iTQCqrp",
    imageAlt:
      "Dark forest green knit polo shirt with delicate collar detail and premium horn buttons",
    badge: { label: "New Arrival", tone: "forest" }
  },
  {
    id: "the-obsidian-overcoat",
    name: "The Obsidian Overcoat",
    material: "Cashmere Blend",
    price: "$1,890",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDb4HgZThk-i_juM7LnHT28IvYp6L3O-BYlcwDKgfj8NoIfTFFhOF2Ole0eBVsqpYg3jj_0TeLOFVAlmWeCOqcLhMrp0WOXtTgYUke-t7sj7lC-e4jEl3lE8aZs01lCVJenptBJf3Fh0f1sdTVQ9W0cWZD8hEtVjX-LK-Bsqoc2UzdzkTUWeVjp7hrhjMGZhuTtvQ56nTXVelw9_F3p1d8ryVxqAzayeUimjbfSI8FHukDr7r45A4VjAJ3lpymfXulGrEM83TxdK6Sj",
    imageAlt:
      "Black luxury overcoat silhouette on a dark moody background with subtle atmospheric lighting"
  },
  {
    id: "relaxed-cargo-trouser",
    name: "Relaxed Cargo Trouser",
    material: "Brushed Twill",
    price: "$340",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCl4XmDPI7ezQ8V8gxeGrc660POpgtn9I63HH9QzEE9jEwVxs3pBTWydjFsSvHLiR7bShuQLN6mMJ-yix90als2hLhJjdIvAJLGOs3ynN6mi3NdPoajfys3YMEiNnbZtyoW3abm8U4uSZFH6FEqu8tLSLjhlBfu6vkWPNF0xAaMgbOlcuTk7KTDrRLQukME-Q6IDgoyTNPy7nGIVQ6vTmB6kAzQTGY4nTfm9aD7PP7zG5oQ_CgZx81cpIuNo6QWnLS0kBho_NXsxxur",
    imageAlt:
      "Close-up of khaki trousers texture with precise pocket detailing and premium hardware"
  }
];

export const shopMenFooterLinks = [
  { label: "Journal", href: "#" },
  { label: "Sustainability", href: "#" },
  { label: "Shipping", href: "#" },
  { label: "Returns", href: "#" },
  { label: "Privacy", href: "#" }
];

export const shopMenHeroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuACWMir-mH0L8UXbUXQWypp-pFR6ldBwMeB_P57xJ4h6lF91JgCYYyEJ27pPIbRuST3wzOd8tibscQ-NbIurAXAyGOUWfZstI5mdT9d5_jh6VLXet-x-y-OPWmMV69qNvZALg2WhY1PVY_SFZnR1pxtNpFxR9lsyyLR7XmqRbJ_dhy0WQE2rK_YiUzI2TXstgAkQ537sWLyCCgyHe5Z2QW16TODc2jAY392leqTD0jFdmPyw689W_PhHTFoOURRakfD2ODeVuxVtb-u";
