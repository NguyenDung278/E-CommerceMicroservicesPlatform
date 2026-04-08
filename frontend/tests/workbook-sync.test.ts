import { describe, expect, it } from "vitest";

import { applyWorkbookProductMutation, applyWorkbookProductMutations } from "../dev/workbook-sync";

const headers = [
  "record_type",
  "position",
  "segment_slug",
  "page_slug",
  "product_id",
  "brand",
  "name",
  "price",
  "image_url",
  "href",
  "eyebrow",
  "size_tag",
  "fit_note",
  "badge",
  "material",
  "image_alt",
  "filter_tags",
];

describe("workbook product sync", () => {
  it("upserts both segment and category-page product rows with detail-page links", () => {
    const nextTable = applyWorkbookProductMutation(
      {
        headers,
        rows: [
          {
            record_type: "site_meta",
            position: "",
            segment_slug: "",
            page_slug: "",
            product_id: "",
            brand: "",
            name: "",
            price: "",
            image_url: "",
            href: "",
            eyebrow: "",
            size_tag: "",
            fit_note: "",
            badge: "",
            material: "",
            image_alt: "",
            filter_tags: "",
          },
        ],
      },
      {
        operation: "upsert",
        product: {
          id: "prod-men-001",
          name: "Structured Atelier Jacket",
          description: "Merino wool outer layer.",
          price: 1250,
          stock: 8,
          category: "Shop Men",
          brand: "ND Atelier",
          tags: ["Limited Edition", "material:Merino Wool"],
          status: "active",
          sku: "MEN-001",
          variants: [
            {
              sku: "MEN-001-M",
              label: "Merino Wool",
              size: "M",
              color: "Forest",
              price: 1250,
              stock: 4,
            },
          ],
          image_url: "https://example.com/jacket.jpg",
          image_urls: ["https://example.com/jacket.jpg"],
        },
      }
    );

    const segmentRow = nextTable.rows.find((row) => row.record_type === "product");
    const categoryRow = nextTable.rows.find((row) => row.record_type === "category_page_product");

    expect(segmentRow?.segment_slug).toBe("nam");
    expect(segmentRow?.product_id).toBe("prod-men-001");
    expect(segmentRow?.href).toBe("/products/prod-men-001");
    expect(categoryRow?.page_slug).toBe("men-atelier");
    expect(categoryRow?.product_id).toBe("prod-men-001");
    expect(categoryRow?.href).toBe("/products/prod-men-001");
    expect(categoryRow?.filter_tags).toContain("size:M");
    expect(categoryRow?.filter_tags).toContain("price:$1000+");
  });

  it("deletes synced workbook rows for the removed product", () => {
    const nextTable = applyWorkbookProductMutation(
      {
        headers,
        rows: [
          {
            record_type: "product",
            position: "1",
            segment_slug: "nam",
            page_slug: "",
            product_id: "prod-men-001",
            brand: "ND Atelier",
            name: "Structured Atelier Jacket",
            price: "1250",
            image_url: "https://example.com/jacket.jpg",
            href: "/products/prod-men-001",
            eyebrow: "Limited Edition",
            size_tag: "Merino Wool",
            fit_note: "Merino wool outer layer.",
            badge: "",
            material: "",
            image_alt: "",
            filter_tags: "",
          },
          {
            record_type: "category_page_product",
            position: "1",
            segment_slug: "",
            page_slug: "men-atelier",
            product_id: "prod-men-001",
            brand: "",
            name: "Structured Atelier Jacket",
            price: "1250",
            image_url: "https://example.com/jacket.jpg",
            href: "/products/prod-men-001",
            eyebrow: "",
            size_tag: "",
            fit_note: "",
            badge: "Limited Edition",
            material: "Merino Wool",
            image_alt: "Structured Atelier Jacket",
            filter_tags: "size:M|price:$1000+",
          },
        ],
      },
      {
        operation: "delete",
        product: {
          id: "prod-men-001",
          name: "Structured Atelier Jacket",
          description: "",
          price: 1250,
          stock: 0,
          category: "Shop Men",
          brand: "ND Atelier",
          tags: [],
          status: "active",
          sku: "MEN-001",
          variants: [],
          image_url: "",
          image_urls: [],
        },
      }
    );

    expect(nextTable.rows).toHaveLength(0);
  });

  it("applies multiple workbook mutations in one batch while keeping row positions stable", () => {
    const nextTable = applyWorkbookProductMutations(
      {
        headers,
        rows: [],
      },
      [
        {
          operation: "upsert",
          product: {
            id: "prod-men-001",
            name: "Structured Atelier Jacket",
            description: "Merino wool outer layer.",
            price: 1250,
            stock: 8,
            category: "Shop Men",
            brand: "ND Atelier",
            tags: ["Limited Edition"],
            status: "active",
            sku: "MEN-001",
            variants: [],
            image_url: "https://example.com/jacket.jpg",
            image_urls: ["https://example.com/jacket.jpg"],
          },
        },
        {
          operation: "upsert",
          product: {
            id: "prod-women-002",
            name: "Silk Archive Dress",
            description: "Fluid silk silhouette.",
            price: 780,
            stock: 4,
            category: "Women",
            brand: "ND Atelier",
            tags: ["Runway"],
            status: "active",
            sku: "WOMEN-002",
            variants: [],
            image_url: "https://example.com/dress.jpg",
            image_urls: ["https://example.com/dress.jpg"],
          },
        },
      ]
    );

    const productRows = nextTable.rows.filter((row) => row.record_type === "product");
    const categoryRows = nextTable.rows.filter((row) => row.record_type === "category_page_product");

    expect(productRows).toHaveLength(2);
    expect(categoryRows).toHaveLength(2);
    expect(productRows.map((row) => row.position)).toEqual(["1", "1"]);
    expect(categoryRows.map((row) => row.position)).toEqual(["1", "1"]);
  });
});
