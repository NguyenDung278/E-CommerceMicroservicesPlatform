export type AtelierCategoryId = "men" | "women" | "footwear" | "accessories";

export type AtelierNavItem = {
  id: "archive" | AtelierCategoryId;
  label: string;
  href: string;
};

export type AtelierHeroLine = {
  text: string;
  italic?: boolean;
};

export type AtelierHeroConfig = {
  variant: "dark-immersive" | "light-editorial" | "light-framed";
  badge?: string;
  eyebrow?: string;
  titleLines: AtelierHeroLine[];
  description: string;
  imageUrl: string;
  imageAlt: string;
};

export type AtelierFilterOption = {
  label: string;
  active?: boolean;
  count?: string;
};

export type AtelierPaletteOption = {
  label: string;
  color: string;
  bordered?: boolean;
  active?: boolean;
};

export type AtelierFilterGroup =
  | {
      kind: "list";
      title: string;
      options: AtelierFilterOption[];
      uppercase?: boolean;
      showCounts?: boolean;
      activeStyle?: "underline" | "bold";
    }
  | {
      kind: "sizes";
      title: string;
      options: AtelierFilterOption[];
      columns?: 2 | 3 | 5;
      compact?: boolean;
    }
  | {
      kind: "palette";
      title: string;
      options: AtelierPaletteOption[];
    }
  | {
      kind: "chips";
      title: string;
      options: string[];
    }
  | {
      kind: "checkboxes";
      title: string;
      options: AtelierFilterOption[];
    }
  | {
      kind: "price";
      title: string;
      minLabel: string;
      maxLabel: string;
      valuePercent: number;
    }
  | {
      kind: "quote-card";
      quote: string;
      attribution: string;
      tone?: "dark" | "light";
    };

export type AtelierBadgeTone = "forest" | "terracotta" | "surface" | "ghost";

export type AtelierCatalogItem =
  | {
      type: "product";
      id: string;
      href: string;
      name: string;
      meta: string;
      price: string;
      imageUrl: string;
      imageAlt: string;
      badge?: {
        label: string;
        tone: AtelierBadgeTone;
      };
      offsetClassName?: string;
      variant?: "editorial" | "split";
      showQuickAction?: boolean;
    }
  | {
      type: "feature";
      id: string;
      title: string;
      description: string;
      ctaLabel: string;
      href: string;
      imageUrl: string;
      imageAlt: string;
      spanClassName?: string;
    };

export type AtelierBottomSection =
  | {
      kind: "quote-band";
      quote: string;
      attribution: string;
    }
  | {
      kind: "story-split";
      imageUrl: string;
      imageAlt: string;
      storyHeading: string;
      storyDescription: string;
      storyCtaLabel: string;
      storyHref: string;
      panelEyebrow: string;
      panelTitle: string;
      panelDescription: string;
    };

export type AtelierPageConfig = {
  id: AtelierCategoryId;
  aliases: string[];
  navLabel: string;
  catalogHref: string;
  hero: AtelierHeroConfig;
  filters: AtelierFilterGroup[];
  showingLabel: string;
  sortLabel: string;
  contentGridClassName?: string;
  products: AtelierCatalogItem[];
  bottomSection?: AtelierBottomSection;
};

export const atelierNavItems: AtelierNavItem[] = [
  { id: "archive", label: "Catalog", href: "/products" },
  { id: "men", label: "Men", href: "/editorial/Shop%20Men" },
  { id: "women", label: "Women", href: "/editorial/Shop%20Women" },
  { id: "footwear", label: "Footwear", href: "/editorial/Footwear" },
  { id: "accessories", label: "Accessories", href: "/editorial/Accessories" },
];

export const atelierFooterLinks = [
  { label: "Journal", href: "/journal" },
  { label: "Sustainability", href: "/sustainability" },
  { label: "Shipping", href: "/shipping" },
  { label: "Returns", href: "/returns" },
  { label: "Privacy", href: "/privacy" },
];

const atelierPages: Record<AtelierCategoryId, AtelierPageConfig> = {
  men: {
    id: "men",
    aliases: ["shop men", "men", "men's atelier", "mens atelier"],
    navLabel: "Men",
    catalogHref: "/products?category=Shop%20Men",
    hero: {
      variant: "dark-immersive",
      badge: "DEV ONLY",
      titleLines: [{ text: "Men’s Atelier" }],
      description: "An architectural study in silhouette and structure. Crafted for the modern artisan.",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuACWMir-mH0L8UXbUXQWypp-pFR6ldBwMeB_P57xJ4h6lF91JgCYYyEJ27pPIbRuST3wzOd8tibscQ-NbIurAXAyGOUWfZstI5mdT9d5_jh6VLXet-x-y-OPWmMV69qNvZALg2WhY1PVY_SFZnR1pxtNpFxR9lsyyLR7XmqRbJ_dhy0WQE2rK_YiUzI2TXstgAkQ537sWLyCCgyHe5Z2QW16TODc2jAY392leqTD0jFdmPyw689W_PhHTFoOURRakfD2ODeVuxVtb-u",
      imageAlt:
        "Close-up of high-quality dark wool fabric texture with subtle lighting highlighting the weave of a tailored suit",
    },
    filters: [
      {
        kind: "list",
        title: "Category",
        options: [
          { label: "Shirts", active: true },
          { label: "Outerwear" },
          { label: "Trousers" },
          { label: "Knitwear" },
        ],
      },
      {
        kind: "sizes",
        title: "Size",
        columns: 2,
        options: [
          { label: "S" },
          { label: "M", active: true },
          { label: "L" },
          { label: "XL" },
        ],
      },
      {
        kind: "price",
        title: "Price Range",
        minLabel: "$150",
        maxLabel: "$2,500",
        valuePercent: 46,
      },
    ],
    showingLabel: "Showing 12 results",
    sortLabel: "Sort by: Relevance",
    contentGridClassName: "lg:grid-cols-[188px_minmax(0,1fr)]",
    products: [
      {
        type: "product",
        id: "sculpted-linen-shirt",
        href: "/products?category=Shop%20Men",
        name: "Sculpted Linen Shirt",
        meta: "Italian Linen Blend",
        price: "$420",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuBRTlahnsv0f7ya3xU5YTERBeygNv3B_6MEExHsUzTI3uGv3gn9RVVaVkXFHJAQIYeO-NnQ-n51wqkjA-oml_uoLI96mxp1piJxtPHA5ofpE_9tSdHTMa8lNfjCgdbUOSRi__Y4J8VFSz5HhI5ZB9C5Vl5zl-6FxNxhAYwEDNV_XOP2dGsj5rTUtGDd1a59qGSue1hdS28wAOq4_SpG152HGpLir9kJsPtGA9trmPt5raubxkNMY1AI1cI7Qs5-pnKuSFT_JrLZrEaz",
        imageAlt:
          "Sophisticated cream tailored linen shirt hanging against a minimalist planner wall with morning shadows",
        badge: { label: "New Arrival", tone: "forest" },
        variant: "editorial",
      },
      {
        type: "product",
        id: "structured-atelier-jacket",
        href: "/products?category=Shop%20Men",
        name: "Structured Atelier Jacket",
        meta: "100% Merino Wool",
        price: "$1,250",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuA004mNLReNQb9OI2U6JwpX4idr5HiAL2OAqj-X2r60qRDaMIYLE7YAWWdvJ6_uvkh1jgDweWN2QRC0Z6CnAXNS54x6M_Qkf8uPtTr4G6Cl5-Y5z8iuGvbIv1u_DCawCRbkf01JSFMi_iZ2APFb_m56yIPq8-_Ap7HY-QbhgAL2tc-tsE4VsnyibszwQjgYBz28AGgGUIIQ7EDmY1bXGdkXyNQI991VG2ouIlVK-wOCqK_Lq8GNj4h27eldl1LjnR6Wt903BlKnHCVn",
        imageAlt:
          "High-end charcoal structured wool jacket detail showing the lapel and precise stitching on a dark background",
        badge: { label: "Limited Edition", tone: "terracotta" },
        offsetClassName: "lg:translate-y-8",
        variant: "editorial",
      },
      {
        type: "product",
        id: "modern-drape-trousers",
        href: "/products?category=Shop%20Men",
        name: "Modern Drape Trousers",
        meta: "Fine Serge Cotton",
        price: "$380",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuBXRSWOWcHtCNyaMDYLCJzvRD_aYObkVBkIHPoz_HZOOuihWxPKo82MAX7anUmfBqHwOgx_6YthGokOn-aqEtAkMya3di9RNTlqqA2-zqT6x85Yh0CGWy5_gOTjOOMYxnRJ7B8A9ihZaMR-PzIAILb7T5rSMUCiZ-3CZRTX_u3XxJpOlXlYjWEZj4aFLaV_mamuWkKjkhTxSRpw7LyICx9lPITcKUuGOxJ0NkpKweDI4rMjqFkSSGZJssErigmmpbKq5Z6kLPVUehXg",
        imageAlt:
          "Pair of folded olive green trousers with sharp creases lying on a light wood surface with natural sunlight",
        variant: "editorial",
      },
      {
        type: "product",
        id: "atelier-knit-polo",
        href: "/products?category=Shop%20Men",
        name: "Atelier Knit Polo",
        meta: "Sea Island Cotton",
        price: "$290",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDBowt2AR0QGkZ_teHLK0qG2iUl8fGSUuNTrZHreU_s95xtmrbnCTB8LYOShnHaraaNDqoUnziBnVe2Rh6OAlJpU9ZSpF84L0-k23aokXc6aJdWswRdyGowycFswnENPgO9tfnUyUaMa2VjW8lGJYkmhPbnJhSE0zC0BdoSTdae8pmGnQwaAXzVlJJRhWYysiO1yf2n_lREj8nVxarkGub1OLnfLI4QrhAiAGV-AZTWnZg1MCqdpNi1pBSjb6RIPFAzXw0h_iTQCqrp",
        imageAlt:
          "Dark forest green knit polo shirt with delicate collar detail and premium horn buttons",
        badge: { label: "New Arrival", tone: "forest" },
        variant: "editorial",
      },
      {
        type: "product",
        id: "obsidian-overcoat",
        href: "/products?category=Shop%20Men",
        name: "The Obsidian Overcoat",
        meta: "Cashmere Blend",
        price: "$1,890",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDb4HgZThk-i_juM7LnHT28IvYp6L3O-BYlcwDKgfj8NoIfTFFhOF2Ole0eBVsqpYg3jj_0TeLOFVAlmWeCOqcLhMrp0WOXtTgYUke-t7sj7lC-e4jEl3lE8aZs01lCVJenptBJf3Fh0f1sdTVQ9W0cWZD8hEtVjX-LK-Bsqoc2UzdzkTUWeVjp7hrhjMGZhuTtvQ56nTXVelw9_F3p1d8ryVxqAzayeUimjbfSI8FHukDr7r45A4VjAJ3lpymfXulGrEM83TxdK6Sj",
        imageAlt:
          "Black luxury overcoat silhouette on a dark moody background with subtle atmospheric lighting",
        offsetClassName: "lg:translate-y-8",
        variant: "editorial",
      },
      {
        type: "product",
        id: "relaxed-cargo-trouser",
        href: "/products?category=Shop%20Men",
        name: "Relaxed Cargo Trouser",
        meta: "Brushed Twill",
        price: "$340",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuCl4XmDPI7ezQ8V8gxeGrc660POpgtn9I63HH9QzEE9jEwVxs3pBTWydjFsSvHLiR7bShuQLN6mMJ-yix90als2hLhJjdIvAJLGOs3ynN6mi3NdPoajfys3YMEiNnbZtyoW3abm8U4uSZFH6FEqu8tLSLjhlBfu6vkWPNF0xAaMgbOlcuTk7KTDrRLQukME-Q6IDgoyTNPy7nGIVQ6vTmB6kAzQTGY4nTfm9aD7PP7zG5oQ_CgZx81cpIuNo6QWnLS0kBho_NXsxxur",
        imageAlt:
          "Close-up of khaki trousers texture with precise pocket detailing and premium hardware",
        variant: "editorial",
      },
    ],
  },
  women: {
    id: "women",
    aliases: ["shop women", "women", "women's atelier", "women’s atelier", "the women's atelier", "the women’s atelier"],
    navLabel: "Women",
    catalogHref: "/products?category=Shop%20Women",
    hero: {
      variant: "light-editorial",
      badge: "DEV ONLY",
      titleLines: [{ text: "The Women’s" }, { text: "Atelier" }],
      description: "A curated selection of architectural silhouettes and natural textiles, designed for the modern form.",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCCHjHHNBD0bZoSfUrXMIUsusvSJpfmxcJRzVyGEWriuKDCynB8NOcLil0MHJfUCfgjmGv_IMPAfbmEm73hz3s6Y6ycMQrKq1qnMzNHz4QbDczvsSfdf8SaL9vw3qoSEt36Xm52OFG4ej1BLs2XxqsJW_tPT1C2xruIyndF6i4KCKATXFKExblf5UqEURDlAYRnWNDYbLXe8GGoCndX4q2IeRKAuk6Etam3vFkW85HI4vZvrHKCLYN63hA-DGdTKTpY9k-VBO3aY4le",
      imageAlt:
        "Close-up of ethereal cream-colored silk fabric draping elegantly in a sun-drenched minimalist atelier with soft morning shadows",
    },
    filters: [
      {
        kind: "list",
        title: "Categories",
        showCounts: true,
        options: [
          { label: "Dresses", count: "12", active: true },
          { label: "Tops", count: "24" },
          { label: "Bottoms", count: "18" },
          { label: "Outerwear", count: "09" },
        ],
      },
      {
        kind: "sizes",
        title: "Size",
        columns: 5,
        compact: true,
        options: [
          { label: "XS" },
          { label: "S", active: true },
          { label: "M" },
          { label: "L" },
          { label: "XL" },
        ],
      },
      {
        kind: "palette",
        title: "Palette",
        options: [
          { label: "Forest", color: "#061b0e" },
          { label: "Cream", color: "#f5f3ee", bordered: true, active: true },
          { label: "Hearth", color: "#320900" },
          { label: "Obsidian", color: "#1b1c19" },
        ],
      },
    ],
    showingLabel: "Showing 63 pieces",
    sortLabel: "Sort By",
    contentGridClassName: "lg:grid-cols-[240px_minmax(0,1fr)]",
    products: [
      {
        type: "product",
        id: "ethereal-silk-slip",
        href: "/products?category=Shop%20Women",
        name: "Ethereal Silk Slip",
        meta: "New Arrival",
        price: "$340",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuA2sL_3eVTxv8pTPhQFFFpSQH6Kaq9or00Ox__PprWsxnH4iFcdyvkF6yE_uLy_crNRWln5sUDsqQmSo-iayh_0MyCYYTR20XSGjWAB-uNe6duE69pSu714RVSt74tQMEIF3fuTduw02xllANi1JDAtn12UeUh9ljLf8hz3xi6jPfnSdYWCX7w9y3IwSDyovmYmtsxb0x9P-3bKU5qLNiMw7cc4_t2zNEpT8QLPRQLTFIXGR2WRSQbgpFitN5ZgjO-BIsY_4Wyg7jRS",
        imageAlt:
          "Model wearing a flowing ethereal silk slip dress in a warm cream color standing in a studio with soft natural light",
        variant: "split",
        showQuickAction: true,
      },
      {
        type: "product",
        id: "architectural-overcoat",
        href: "/products?category=Shop%20Women",
        name: "Architectural Overcoat",
        meta: "Outerwear",
        price: "$1,250",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuBmKXEwtGPg000dRd0DYpkc78_z_0z7Q60H3fju2rnkDAllnKGSFzesSqKvn2OqncI_k-QRIvUyfVSm75I-UKw3DhxiM5eOINn4C-vJnvj2z8uKIL2AqGnXgvmqeYEEzJ5-il3zT3BTGt9iPabLxhcPbK9AwTzCM3Z9Fo3vrhfReTlHCTZ3EIgs7_JxhOFfmrNerCamtXr0QKPKlok1p5W71S8CFoXMlgrk9yrqe55hyi8oG24OwLIfOD6sAGZDuAtdrYmvQ0QD-hzg",
        imageAlt:
          "High-end architectural overcoat in deep forest green tailored perfectly with sharp lines and textured wool",
        badge: { label: "Limited", tone: "ghost" },
        variant: "split",
      },
      {
        type: "product",
        id: "cloud-cashmere-crew",
        href: "/products?category=Shop%20Women",
        name: "Cloud Cashmere Crew",
        meta: "Knitwear",
        price: "$280",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuBEKFEZ7Xk7Fyqc9Uf8Rr7JfhPIghhY7j0HO6bqSglckdRAUU1XFK1Vy_uPXAbpLqczXmCH41FFfT4QIgBtt7oBHhaEojRqYoMhEeW0zN9yDlgFxnnAhZfa_FjmfnZNakXUp-HAT6D2gb_BUeHA5TXBmMVsObd_AHQfOwPuMZTKrAqSkXnJe60KUnlOWajJ6btQ5zyNadwls33tVZNcDlHyJ8_EUlUAhHRtQ90ZhEzMNN5Mzjf_Hr7Onn7MZF-hkz45XkPrdm6pngSw",
        imageAlt:
          "Soft cloud cashmere crew neck sweater in a warm stone grey color resting on a wooden chair in soft lighting",
        variant: "split",
      },
      {
        type: "product",
        id: "sculptural-pleated-skirt",
        href: "/products?category=Shop%20Women",
        name: "Sculptural Pleated Skirt",
        meta: "Bottoms",
        price: "$490",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAULIeOGtZd7vXZH0gSJHWiv3w1w4d6Tz7E7Y55Pp0wpbrudgRPkQEUxLNJ7z1iX2ofjNS4KSwbIFdzRgJR2rZEzslEi02TskRTUycOtweLNiBcTRv0RAiCUncTPXaXvHGzovAfwglQIxRlDavgkG0kp9z1__77ZtFulQa4AVlvR_muVhFSILTRpDDYMIgzrzsCEPjKJNyVc0k_NtV_qrK021aTU5RlI_Mg4TBu8JIzJLGkLHTEGfvWBezAYGbi6wNp_bgFRdeYEwST",
        imageAlt:
          "Woman wearing a sculptural pleated skirt in deep charcoal grey walking through a brutalist concrete building",
        offsetClassName: "md:-translate-y-10",
        variant: "split",
      },
      {
        type: "product",
        id: "hearth-tapered-pant",
        href: "/products?category=Shop%20Women",
        name: "Hearth Tapered Pant",
        meta: "Bottoms",
        price: "$320",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAaOoy5mPR6kERrz2pjB05mC0JlxtRtsf2hinDbaZYFD7RKSJI_OTZn_SVo1D7JP85uSvsIZaQ5ebu77UNrwEjYJZhP6gfcKLOHkl-z5NFjTzCwUsmsvv1WbILS5HtKtmz6D5YPmeIASNcfDev_nsQcB5Odi4O5svKDuTAkJyHAlgm2j2VUKiwX_XzxOMsMjnnzRdyJcj-olztbGq4uYqe6FRhYp04lXvSqa4dkOjD9RZ1tB8UYpCw_Jj4C-Vwk4eokTl5ETem6rnWz",
        imageAlt:
          "Detail shot of high-end trousers with refined stitching in a soft terracotta clay color",
        variant: "split",
      },
      {
        type: "product",
        id: "atelier-formal-blazer",
        href: "/products?category=Shop%20Women",
        name: "Atelier Formal Blazer",
        meta: "Outerwear",
        price: "$850",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuCLcoGr7KP32O8-hGiy_R2XgyAroX9NifHN9bp-cIa4MHixZs87jXhzocVyCNAS3MnosR5YMFpf4FISO7lLR-kKnFLGlEzEpOj83h0kbOwK6Pnh34L5HRcDXs-mn4MSca3ZHmi1j5JFvCLSAtZqcx49HaXw-0ig_4UGpNNyJn-jbSUufnz2HoBnnsHCFAoTAfl496e8aw7KajnM3HNoABdqEW2LpHzMvPXX5bXFHa5HQuxPuycHrYw8i-08kA3CEEThIkKU4-Ah21WT",
        imageAlt:
          "Model wearing a structured minimal blazer in forest green sitting on an antique velvet chair",
        offsetClassName: "md:translate-y-10",
        variant: "split",
      },
    ],
    bottomSection: {
      kind: "story-split",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCLsY0s2ZGLvPOl_WOwZoRpU02WbZGuHEO8UYQbV-QWMzzX129rq4Z6wr0Of9_rO5ILe2ORGFxzdGgYxdkYQuGX8LuAiJFBn-AWJ_STJTV3_Qaw1EYkxhfRFuy2Smn4yO_ovskCl5pppFCtSalHvg7ma1t9y4vciyHBl-hT5g_UQz_FOFrLG2NslH8KuNQiQDfwe7niMFOYjLd2kzxg__y2CRqR6UmCP7dbDRT-sBxMV1FcW2COldHDSQ6HCHyiqNEFS1cu9JEhcRAA",
      imageAlt:
        "Wide shot of a fashion atelier with large windows, rolls of fine fabric, and a dress form with a partially constructed garment",
      storyHeading: "The Craftsmanship",
      storyDescription: "Every piece is hand-finished in our northern studio, prioritizing ethical labor and carbon-neutral distribution.",
      storyCtaLabel: "Read the Story",
      storyHref: "/sustainability",
      panelEyebrow: "Our Mission",
      panelTitle: "Quiet Luxury, Defined by Purpose.",
      panelDescription:
        "ND Shop stands at the intersection of traditional couture and digital efficiency. We believe in pieces that last decades, not seasons.",
    },
  },
  footwear: {
    id: "footwear",
    aliases: ["footwear", "footwear atelier", "the footwear edit", "shoes"],
    navLabel: "Footwear",
    catalogHref: "/products?category=Footwear",
    hero: {
      variant: "light-editorial",
      eyebrow: "The Digital Atelier",
      titleLines: [{ text: "Footwear Atelier" }],
      description:
        "A curated collection of sculptural silhouettes, handcrafted from the finest Italian hides. Where traditional craftsmanship meets modern architectural precision.",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAFXvDME4hl86EBAExrs0TPuPyrDnhtwEb8MCDCvjzu2OS-kjWnUF7XkqwYs0MGf5WGZS6B5xPKLv0OXCG5ZrDjkm-McNkALLC0DCYp5LC9beGhY0SnzFUMFF998AElRWMoxze_NVDcZ1jJ4qerfPiE1xI5Xjc0Euy-lzfbdQzjbDW9gtsemGrCxPBq4MDAxVn_PdqcdHWaZ05cl7EMLinkvr6U9D8RGxe-UFtVaee5Q6n-Ohev-vr9h8DwExyawlWEZa9kUKDqsxlQ",
      imageAlt:
        "Close-up of premium leather shoemaking tools and high-end footwear materials in a brightly lit artisan workshop",
    },
    filters: [
      {
        kind: "list",
        title: "Type",
        activeStyle: "underline",
        options: [
          { label: "Boots", active: true },
          { label: "Sneakers" },
          { label: "Loafers" },
          { label: "Sandals" },
        ],
      },
      {
        kind: "sizes",
        title: "Size",
        columns: 3,
        compact: true,
        options: [
          { label: "40" },
          { label: "41" },
          { label: "42" },
          { label: "43", active: true },
          { label: "44" },
          { label: "45" },
        ],
      },
      {
        kind: "checkboxes",
        title: "Material",
        options: [{ label: "Calfskin", active: true }, { label: "Suede" }, { label: "Grain Leather" }],
      },
    ],
    showingLabel: "Showing 5 objects",
    sortLabel: "Sort by: Atelier Picks",
    contentGridClassName: "lg:grid-cols-[240px_minmax(0,1fr)]",
    products: [
      {
        type: "product",
        id: "atelier-low-sneaker",
        href: "/products?category=Footwear",
        name: "Atelier Low Sneaker",
        meta: "Smooth Italian Calfskin",
        price: "$340",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAMYKBjYQhfEPiX1rrzGJqP-bZ3N-za3aIYrq4ZJ7iHUOBBELUJUpvBk3Ms1bHaAXBuEZwTIczKGpjLz2AbAXSyAma0h_FRPa4MA_RgE9EO-SCavieX4XPDLcnuloZs8tAGD5FGHlcBtSszlVWYz-FA-hca0gi-xkAC4k_vrZmULdCAPQNXUhSbE3wrhj8_XgthXU6Aso4ltg4ME3nEgOsgEaBDUB6hKvQ_Ere_31vsZ98zkTq0zGrgjNqUJHCDPBUQPmqG9Q702KKw",
        imageAlt:
          "Minimalist premium white leather sneakers on a neutral architectural background with soft shadows",
        badge: { label: "New Arrival", tone: "surface" },
        variant: "editorial",
      },
      {
        type: "product",
        id: "chelsea-field-boot",
        href: "/products?category=Footwear",
        name: "Chelsea Field Boot",
        meta: "Waxed Roughout Leather",
        price: "$495",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuD5KVhgLop51bisay_zrsW8YVtKdD2et-udRx64dbQtp0xYp4CE38R94dLqJO460aolSqy9UdPhfvdjSyjzz7Bbh4MOeBkHbehqlMCTvPNv4PLXn3wFu6XqNIM_5UyUXX71NRni2ntQt4twbRrDvUPUi5cDXb-939ibHoOeSHMsDghYNOy7kZp5gd14kjIf6WUveYq0O9RFsuf5oY9RK1U9jhhlcJ_HJPXAwSBdNK2y67FH0n0MdcVNPoEwpIxvSAkUOZdh9YgdL7FA",
        imageAlt:
          "Elegant dark brown leather chelsea boots with a polished finish and refined silhouette",
        badge: { label: "Handcrafted", tone: "forest" },
        offsetClassName: "lg:translate-y-10",
        variant: "editorial",
      },
      {
        type: "product",
        id: "classic-penny-loafer",
        href: "/products?category=Footwear",
        name: "Classic Penny Loafer",
        meta: "Pebbled Grain Leather",
        price: "$420",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAAhJretAaN4nn0hwa-S3geRVjspqi5Iysp4o9wJ6Umsp05BfiGqmXjoyIkxI-iO9bJQHh6aFW1ByRoH4hP6tAQ1ifpRkG88XfFjHc7Tu8bEt310kgkBdS8l4wXyGN477geZFXoBXA7tpLWEx-ySFm69csgvDnFB-DbTmu1Va59aScYOFNkVt4WimRi19ZpDNf2YvhkDC8ETmf7ZpivWgg0fG1e-5cX386ZaOUDjcQ35GqrXeknlGJ-ig73LknVdiR_VbQ_rfBrjtto",
        imageAlt:
          "Classic black leather loafers with a modern minimalist buckle and slim profile",
        variant: "editorial",
      },
      {
        type: "product",
        id: "moc-toe-service-boot",
        href: "/products?category=Footwear",
        name: "Moc Toe Service Boot",
        meta: "English Bridle Leather",
        price: "$560",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuD4G3y0ZNdrqZS0ATojfSYa5t42Vrrx476FUX5qzvdCm_CCtF0C5yrINsDw4_G71jrBcMmaoueccHcMXO1xws91KQPeOyvLKzB9nAJZ70r7sO7YUn_u5DMqM93aUESLHoGVqBzejgzYA6j31SfDmrQl3IeBeL-xTBwhgq4AG_zSgROd0lwpbM9okRm26Hm2PbSk7bsL6aFYLo561VTjxiVDA_m28FuAt2wvBZpwLQNP23z7cESJyuNoMgdIyfHRBsZerL9BQbZ5D2p1",
        imageAlt:
          "High-top handcrafted leather service boots in tobacco tan color with premium hardware",
        variant: "editorial",
      },
      {
        type: "feature",
        id: "heritage-series",
        title: "The Heritage Series",
        description: "Each pair is lasted by hand in our Marche workshop, requiring over 120 unique steps of production.",
        ctaLabel: "Discover Craft",
        href: "/products?category=Footwear",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuCZ-APurl8_BiFwk3y7F_FQ6yAaUu7Zw5a3SwI1fKprr5Hl-pEJ7RvuePMticspNlEb5sfivV0hr3ziS5sz0bG3RDIHQNbSSzVxf4yy3SHrI1HYxt840txIaJXkqTxhDPEGqQSpKgpzORrmx7_dH36fEu9yV1wBLd4EFXPI3P9HF88KpxwOrHRf3Eo3vbpyF_6SUQioP80y8xLrbwF-t0TcylSeDTua3_2ycuM0U1UJFevlpmB_l93PUKlm0qiZoLJ5S6tUaoLL6bvQ",
        imageAlt:
          "Abstract editorial shot of fine shoe laces and leather texture in high contrast lighting",
        spanClassName: "md:col-span-2",
      },
    ],
    bottomSection: {
      kind: "quote-band",
      quote: "Luxury is not the absence of imperfection, but the presence of character.",
      attribution: "Master Shoemaker, ND Atelier",
    },
  },
  accessories: {
    id: "accessories",
    aliases: ["accessories", "accessories atelier", "curated accessories"],
    navLabel: "Accessories",
    catalogHref: "/products?category=Accessories",
    hero: {
      variant: "light-framed",
      titleLines: [{ text: "Accessories" }, { text: "Atelier", italic: true }],
      description:
        "A curated collection of tactile essentials, defined by material integrity and architectural form. Crafted for the discerning individual.",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBlb713Ad1ZqSwci4xtZudIi3pLSP2LntjrYOZbjlMC3NLKbFllzQBjpelA2EcNqh24qXtAEpJDAyVB3yIDQIFXvkmKD86_5kVoAVPrMjID1bCAWG7fccKmwcS9kJ41ohvAPtYZJCMl2fOWYpy8JLZLlE7ksjMmFK7UnFdxUeGvbhsRltWVAsAFxPv7hkz1uizaDdvr0s5HWGulhxwsX6bDRakqRxoA2bYrvMeQA0Nta95LkdO9PMTmAYDvvqhCUeQTFYjDd4sXr9q0",
      imageAlt:
        "Close-up of high-quality vegetable tanned leather and fine stitching tools on a sunlit wooden workbench with soft shadows",
    },
    filters: [
      {
        kind: "list",
        title: "Category",
        uppercase: true,
        options: [
          { label: "All Objects", active: true },
          { label: "Bags" },
          { label: "Belts" },
          { label: "Jewelry" },
          { label: "Scarves" },
        ],
      },
      {
        kind: "chips",
        title: "Material",
        options: ["Raw Silk", "Vachetta", "Sterling Silver", "Cashmere"],
      },
      {
        kind: "quote-card",
        quote: "True luxury is found in the hidden details of the stitch.",
        attribution: "The Master Artisan",
        tone: "dark",
      },
    ],
    showingLabel: "Showing 6 objects",
    sortLabel: "Sort by: Curated Order",
    contentGridClassName: "lg:grid-cols-[230px_minmax(0,1fr)]",
    products: [
      {
        type: "product",
        id: "atelier-tote",
        href: "/products?category=Accessories",
        name: "Atelier Tote",
        meta: "Vegetable Tanned Leather",
        price: "$840",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuBBESdqWOWSR5qEzSZhDSiYksfl92Z2-nXfieKv7zls3FB-7JuZVx-N6rXRCgkpMkJyxFCIzvAJAfUETLq2m7IDhOFmOtlLXZ9qEspJxSM3dIgXBbd3dzVswFhn3Y0MqayyDJYGSylH-MIjZnLLMaswkecd7-JUIltIP_szY3CTjkboRukxyb0Hicjh_fTS7Q8NRXCPfvyi2Gd8UjbveWvWIIUauI-d4h0ra0W790prCr-I9666OBdQ8zWwoQM8OSo6iYMbifIvLw2n",
        imageAlt:
          "Minimalist architectural leather tote bag in deep forest green hanging against a neutral beige concrete wall",
        badge: { label: "Limited Edition", tone: "forest" },
        variant: "editorial",
      },
      {
        type: "product",
        id: "aurora-wrap",
        href: "/products?category=Accessories",
        name: "Aurora Wrap",
        meta: "Organic Raw Silk",
        price: "$215",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuCJ_mIoxtuOYX0UmZ6fp1vpG_etnXOkuxN0sOW8aXUVddHj5eDEGxKoK_oij-8jI8EDqrG_IXPuR5HXX_5FgjnVIMXKR3rvffkz_2hI2uHpAzMIbNZASVlBgA47Ecvrg53PTIsx8zim-xN9ZKFMoR3ivhIQDQ1jUJ0fFx2scgrGApYeeDOx-irk-VfW38VMHIZ4QMUtn6sXwUjEJRXtZ8dTLBnKQVPGxBzf7oOFEbYGY_2P__2xLjofQjJvPkwrIzkn9OjMEUgKEC2O",
        imageAlt:
          "Artisanal silk scarf with abstract earthy patterns draped elegantly over a mid-century wooden chair",
        badge: { label: "Essential", tone: "terracotta" },
        variant: "editorial",
      },
      {
        type: "product",
        id: "cintura-belt",
        href: "/products?category=Accessories",
        name: "Cintura Belt",
        meta: "Full Grain Saddle Leather",
        price: "$165",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDclyoI7lW_Aez2lBayMz4ES5BVdH-wo43IL4ZwpD4HLQkaJqfV3eDM-qMUs4V8Uyl6BTZ9FSNg7ExFisE6J-TMxcflCy5mFritcP54bDT49eqwGnwGnsOeheOgbCmpdtfGvnHaqpfmRpU4zQvBD7B4tmigGgv7hCDEHWLojIzOlAfe5p-0cCnzLjktClPIw5lG6h2qfT0buVNcsY57FFriSrjdMpV_jPcwn3Dwsz1C-8IS20dhOYE1-Kak6Hi0R-OiEeULdIqMBj2c",
        imageAlt:
          "Classic leather belt with a solid brass buckle displayed on a flat surface with dramatic minimalist lighting",
        variant: "editorial",
      },
      {
        type: "product",
        id: "vault-clutch",
        href: "/products?category=Accessories",
        name: "Vault Clutch",
        meta: "Nappa Leather",
        price: "$420",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAc-xgefZmjRHW4tYawNPs3ljWfgQ66YMBuFgX39XflOo-rQyjbJ2Ju2V0nLkyj2SVuz2BKsp1ucM74P4Gg2Q-TiJKsqrjsQRpxYORvaVExN0KFMkAU9KQFmWEmtNZHK5dm7iBBb1zYMTsluHO4Em5IwIi3lS3JGSUeU_unqmYgh-Fw65tcUaH2Ywxl8ag7h1znu1rGefQrkuDTARLHNwtQdpiGPKWCCp8JpO_yLO4kKGzLmwj8g3VfRzxs02GzkmBt2St6l1zyFYZU",
        imageAlt:
          "Small sculptural leather clutch bag in a warm cognac shade resting on a stack of architectural books",
        offsetClassName: "lg:translate-y-8",
        variant: "editorial",
      },
      {
        type: "product",
        id: "obsidian-band",
        href: "/products?category=Accessories",
        name: "Obsidian Band",
        meta: "925 Sterling Silver",
        price: "$310",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDwib-yVKWuTMsi4heheiLMLuw3Aukcrj4t8F5TLsWcUDULrkliTF_b5hFcyekqcaoBOrRCOob6yU3tV5aJCQChHBAggBedojt1THWZ_F-1GiBclBPJw389BrO0MvSA5xrOo1ssievm9rXO2UiIT0Ix_tHvr6rnGAPSAVNt1DYmLJVg_7vuvdan2zI6d3Z7JsuFwAqcipqjdi0FbCpFwqD4d7bZrq5JeL4i4aGx5NsOkOBZScx3UPHkR_rmJldHJi3Cb4MoiZaIoNsN",
        imageAlt:
          "Macro shot of a hand-hammered sterling silver ring on a piece of dark obsidian rock",
        badge: { label: "Limited Edition", tone: "forest" },
        offsetClassName: "lg:translate-y-8",
        variant: "editorial",
      },
      {
        type: "product",
        id: "mist-scarf",
        href: "/products?category=Accessories",
        name: "Mist Scarf",
        meta: "Italian Crepe de Chine",
        price: "$190",
        imageUrl:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuDN-hyvD-tpmpnrjbrTMJWDGqE0s5kawhr4w-1p4Dlepm8ASKNfVET3_ZfWAylFHaiaB9AH-TknXCeSpBRWvpInZZUScAh_758cjQJ5PaoA3RhpvoffLWAKbsHbi60T6N8hGNbE_sQT9A7VvxyQ1jrI_Em8CPdh_sPFl6WDvUDWgej8SV5dMy0I3rh2bRaOuos-kCbK7PSOwtfkZusyFmIIpE57dlcnn58UPP0g_qoZEn8IJHlK36npcQ-nhNrl0ovSjLnUBiBHFBca",
        imageAlt:
          "Monochromatic silk scarf with delicate fringe details draped against a soft cream fabric background",
        offsetClassName: "lg:translate-y-8",
        variant: "editorial",
      },
    ],
  },
};

export const shopMenPageConfig = atelierPages.men;

export function getAtelierPageConfig(categoryName: string) {
  const normalizedCategory = categoryName.trim().toLowerCase();

  return (
    Object.values(atelierPages).find((page) =>
      page.aliases.some((alias) => alias === normalizedCategory),
    ) ?? null
  );
}
