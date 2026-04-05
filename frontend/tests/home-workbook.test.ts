import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  findHomeWorkbookCategoryPage,
  loadHomeWorkbookFromFile,
} from "../src/features/home/workbook";

describe("home workbook parser", () => {
  it("parses flat csv rows using the homepage workbook schema", async () => {
    const sheet = XLSX.utils.json_to_sheet([
      {
        record_type: "site_meta",
        brand_name: "ND Shop",
        footer_caption: "Crafted for the Discerning",
        footer_note: "Workbook-driven editorial homepage.",
      },
      {
        record_type: "nav_item",
        position: 1,
        slug: "all-archive",
        label: "All Archive",
        href: "/products",
        is_default: true,
      },
      {
        record_type: "hero",
        segment_slug: "all-archive",
        collection_kicker: "Winter 2024 Collection",
        title: "Forest & Hearth",
        description: "Workbook-driven hero copy.",
        primary_cta_label: "Explore Collection",
        primary_cta_href: "/products",
        secondary_cta_label: "View Lookbook",
        secondary_cta_href: "/products",
        background_image: "https://example.com/hero.jpg",
        quote_kicker: "Technical Edge",
        quote_body: "Hero quote from workbook.",
        accent: "#946246",
        arrivals_kicker: "New Arrivals",
        arrivals_title: "Seasonal Essentials",
      },
      {
        record_type: "category_tile",
        segment_slug: "all-archive",
        position: 1,
        eyebrow: "Menswear",
        title: "Shop Men",
        subtitle: "Tile subtitle from workbook.",
        image_url: "https://example.com/tile.jpg",
        cta_label: "Explore Men",
        cta_href: "/products",
      },
      {
        record_type: "callout",
        segment_slug: "all-archive",
        eyebrow: "Technical Editorial",
        title: "Digital Precision, Analogue Soul.",
        body: "Callout body from workbook.",
        image_url: "https://example.com/callout.jpg",
      },
      {
        record_type: "metric",
        segment_slug: "all-archive",
        position: 1,
        value: "0.4s",
        label: "Inventory Latency",
      },
      {
        record_type: "product",
        segment_slug: "all-archive",
        position: 1,
        product_id: "archive-001",
        eyebrow: "Archive Pick",
        brand: "Atelier",
        name: "Merino Field Overshirt",
        price: 2490000,
        size_tag: "M",
        fit_note: "Product note from workbook.",
        image_url: "https://example.com/product.jpg",
        href: "/products",
      },
      {
        record_type: "footer_link",
        position: 1,
        label: "Sustainability",
        href: "/products",
      },
      {
        record_type: "category_page",
        slug: "men-atelier",
        nav_label: "Men",
        route_aliases: "Shop Men|shop-men|Men",
        hero_eyebrow: "The Men's",
        hero_title: "Men's Atelier",
        hero_description: "Workbook-driven men's category page.",
        hero_image_url: "https://example.com/men-hero.jpg",
        quote_body: "Structure, restraint, and material depth.",
        quote_author: "ND Atelier",
        story_title: "The Obsidian Overcoat",
        story_body: "Story body from workbook.",
        story_image_url: "https://example.com/story.jpg",
        results_label: "Showing %count% results",
        sort_label: "Sort by: Relevance",
      },
      {
        record_type: "category_filter",
        page_slug: "men-atelier",
        position: 1,
        filter_key: "category",
        label: "Category",
        options: "Shirts|Outerwear|Trousers",
      },
      {
        record_type: "category_page_product",
        page_slug: "men-atelier",
        position: 1,
        badge: "New Arrival",
        name: "Sculpted Linen Shirt",
        material: "Italian Linen Blend",
        price: 420,
        image_url: "https://example.com/men-shirt.jpg",
        href: "/categories/Shop%20Men",
        filter_tags: "category:shirts|size:m",
      },
    ]);
    const csv = XLSX.utils.sheet_to_csv(sheet);

    const file = {
      name: "stitchfix-home.csv",
      text: async () => csv,
    } as File;
    const content = await loadHomeWorkbookFromFile(file);

    expect(content.sourceKind).toBe("upload");
    expect(content.footer.brandName).toBe("ND Shop");
    expect(content.navItems).toHaveLength(1);
    expect(content.segments).toHaveLength(1);
    expect(content.segments[0]?.hero.title).toBe("Forest & Hearth");
    expect(content.segments[0]?.tiles[0]?.title).toBe("Shop Men");
    expect(content.segments[0]?.callout?.title).toBe("Digital Precision, Analogue Soul.");
    expect(content.segments[0]?.metrics[0]?.value).toBe("0.4s");
    expect(content.segments[0]?.products[0]?.name).toBe("Merino Field Overshirt");
    expect(content.footerLinks[0]?.label).toBe("Sustainability");
    expect(content.categoryPages).toHaveLength(1);
    expect(content.categoryPages[0]?.heroTitle).toBe("Men's Atelier");
    expect(content.categoryPages[0]?.filters[0]?.options).toEqual([
      "Shirts",
      "Outerwear",
      "Trousers",
    ]);
    expect(content.categoryPages[0]?.products[0]?.name).toBe("Sculpted Linen Shirt");
    expect(findHomeWorkbookCategoryPage(content, "Shop Men")?.slug).toBe("men-atelier");
  });
});
