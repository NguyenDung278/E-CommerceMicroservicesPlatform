export type AtelierCategoryId = string;

export type AtelierNavItem = {
  id: string;
  label: string;
  href: string;
};

export type AtelierFooterLink = {
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
