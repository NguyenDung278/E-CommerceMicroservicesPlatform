export type ShopAccessoriesCategoryOption = {
  label: string;
  active?: boolean;
};

export type ShopAccessoriesMaterialTag = {
  label: string;
  active?: boolean;
};

export type ShopAccessoriesProductBadge = {
  label: string;
  tone: "primary" | "accent";
};

export type ShopAccessoriesProduct = {
  id: string;
  name: string;
  material: string;
  price: string;
  imageUrl: string;
  imageAlt: string;
  badge?: ShopAccessoriesProductBadge;
  offset?: boolean;
};

export const shopAccessoriesHero = {
  title: "Accessories",
  emphasis: "Atelier",
  description:
    "A curated collection of tactile essentials, defined by material integrity and architectural form. Crafted for the discerning individual.",
  imageUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBlb713Ad1ZqSwci4xtZudIi3pLSP2LntjrYOZbjlMC3NLKbFllzQBjpelA2EcNqh24qXtAEpJDAyVB3yIDQIFXvkmKD86_5kVoAVPrMjID1bCAWG7fccKmwcS9kJ41ohvAPtYZJCMl2fOWYpy8JLZLlE7ksjMmFK7UnFdxUeGvbhsRltWVAsAFxPv7hkz1uizaDdvr0s5HWGulhxwsX6bDRakqRxoA2bYrvMeQA0Nta95LkdO9PMTmAYDvvqhCUeQTFYjDd4sXr9q0",
  imageAlt:
    "Close-up of high-quality vegetable tanned leather and fine stitching tools on a sunlit wooden workbench with soft shadows"
};

export const shopAccessoriesCategories: ShopAccessoriesCategoryOption[] = [
  { label: "All Objects", active: true },
  { label: "Bags" },
  { label: "Belts" },
  { label: "Jewelry" },
  { label: "Scarves" }
];

export const shopAccessoriesMaterials: ShopAccessoriesMaterialTag[] = [
  { label: "Raw Silk", active: true },
  { label: "Vachetta" },
  { label: "Sterling Silver" },
  { label: "Cashmere" }
];

export const shopAccessoriesQuoteCard = {
  text: "True luxury is found in the hidden details of the stitch.",
  author: "The Master Artisan"
};

export const shopAccessoriesProducts: ShopAccessoriesProduct[] = [
  {
    id: "atelier-tote",
    name: "Atelier Tote",
    material: "Vegetable Tanned Leather",
    price: "$840",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBBESdqWOWSR5qEzSZhDSiYksfl92Z2-nXfieKv7zls3FB-7JuZVx-N6rXRCgkpMkJyxFCIzvAJAfUETLq2m7IDhOFmOtlLXZ9qEspJxSM3dIgXBbd3dzVswFhn3Y0MqayyDJYGSylH-MIjZnLLMaswkecd7-JUIltIP_szY3CTjkboRukxyb0Hicjh_fTS7Q8NRXCPfvyi2Gd8UjbveWvWIIUauI-d4h0ra0W790prCr-I9666OBdQ8zWwoQM8OSo6iYMbifIvLw2n",
    imageAlt:
      "Minimalist architectural leather tote bag in deep forest green hanging against a neutral beige concrete wall",
    badge: { label: "Limited Edition", tone: "primary" }
  },
  {
    id: "aurora-wrap",
    name: "Aurora Wrap",
    material: "Organic Raw Silk",
    price: "$215",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCJ_mIoxtuOYX0UmZ6fp1vpG_etnXOkuxN0sOW8aXUVddHj5eDEGxKoK_oij-8jI8EDqrG_IXPuR5HXX_5FgjnVIMXKR3rvffkz_2hI2uHpAzMIbNZASVlBgA47Ecvrg53PTIsx8zim-xN9ZKFMoR3ivhIQDQ1jUJ0fFx2scgrGApYeeDOx-irk-VfW38VMHIZ4QMUtn6sXwUjEJRXtZ8dTLBnKQVPGxBzf7oOFEbYGY_2P__2xLjofQjJvPkwrIzkn9OjMEUgKEC2O",
    imageAlt:
      "Artisanal silk scarf with abstract earthy patterns draped elegantly over a mid-century wooden chair",
    badge: { label: "Essential", tone: "accent" }
  },
  {
    id: "cintura-belt",
    name: "Cintura Belt",
    material: "Full Grain Saddle Leather",
    price: "$165",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDclyoI7lW_Aez2lBayMz4ES5BVdH-wo43IL4ZwpD4HLQkaJqfV3eDM-qMUs4V8Uyl6BTZ9FSNg7ExFisE6J-TMxcflCy5mFritcP54bDT49eqwGnwGnsOeheOgbCmpdtfGvnHaqpfmRpU4zQvBD7B4tmigGgv7hCDEHWLojIzOlAfe5p-0cCnzLjktClPIw5lG6h2qfT0buVNcsY57FFriSrjdMpV_jPcwn3Dwsz1C-8IS20dhOYE1-Kak6Hi0R-OiEeULdIqMBj2c",
    imageAlt:
      "Classic leather belt with a solid brass buckle displayed on a flat surface with dramatic minimalist lighting"
  },
  {
    id: "vault-clutch",
    name: "Vault Clutch",
    material: "Nappa Leather",
    price: "$420",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAc-xgefZmjRHW4tYawNPs3ljWfgQ66YMBuFgX39XflOo-rQyjbJ2Ju2V0nLkyj2SVuz2BKsp1ucM74P4Gg2Q-TiJKsqrjsQRpxYORvaVExN0KFMkAU9KQFmWEmtNZHK5dm7iBBb1zYMTsluHO4Em5IwIi3lS3JGSUeU_unqmYgh-Fw65tcUaH2Ywxl8ag7h1znu1rGefQrkuDTARLHNwtQdpiGPKWCCp8JpO_yLO4kKGzLmwj8g3VfRzxs02GzkmBt2St6l1zyFYZU",
    imageAlt:
      "Small sculptural leather clutch bag in a warm cognac shade resting on a stack of architectural books",
    offset: true
  },
  {
    id: "obsidian-band",
    name: "Obsidian Band",
    material: "925 Sterling Silver",
    price: "$310",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDwib-yVKWuTMsi4heheiLMLuw3Aukcrj4t8F5TLsWcUDULrkliTF_b5hFcyekqcaoBOrRCOob6yU3tV5aJCQChHBAggBedojt1THWZ_F-1GiBclBPJw389BrO0MvSA5xrOo1ssievm9rXO2UiIT0Ix_tHvr6rnGAPSAVNt1DYmLJVg_7vuvdan2zI6d3Z7JsuFwAqcipqjdi0FbCpFwqD4d7bZrq5JeL4i4aGx5NsOkOBZScx3UPHkR_rmJldHJi3Cb4MoiZaIoNsN",
    imageAlt:
      "Macro shot of a hand-hammered sterling silver ring on a piece of dark obsidian rock",
    badge: { label: "Limited Edition", tone: "primary" },
    offset: true
  },
  {
    id: "mist-scarf",
    name: "Mist Scarf",
    material: "Italian Crepe de Chine",
    price: "$190",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDN-hyvD-tpmpnrjbrTMJWDGqE0s5kawhr4w-1p4Dlepm8ASKNfVET3_ZfWAylFHaiaB9AH-TknXCeSpBRWvpInZZUScAh_758cjQJ5PaoA3RhpvoffLWAKbsHbi60T6N8hGNbE_sQT9A7VvxyQ1jrI_Em8CPdh_sPFl6WDvUDWgej8SV5dMy0I3rh2bRaOuos-kCbK7PSOwtfkZusyFmIIpE57dlcnn58UPP0g_qoZEn8IJHlK36npcQ-nhNrl0ovSjLnUBiBHFBca",
    imageAlt:
      "Monochromatic silk scarf with delicate fringe details draped against a soft cream fabric background",
    offset: true
  }
];
