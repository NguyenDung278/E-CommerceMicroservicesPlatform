ANALYZE categories;
ANALYZE category_aliases;
ANALYZE editorial_sections;
ANALYZE featured_products;
ANALYZE products;

\echo '--- storefront categories query ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    c.slug,
    c.display_name,
    c.nav_label,
    c.status,
    c.hero,
    c.filter_config,
    c.seo,
    c.created_at,
    c.updated_at,
    COALESCE(array_remove(array_agg(ca.alias ORDER BY ca.alias), NULL), '{}') AS aliases
FROM categories c
LEFT JOIN category_aliases ca ON ca.category_slug = c.slug
WHERE c.status = 'active'
GROUP BY c.slug, c.display_name, c.nav_label, c.status, c.hero, c.filter_config, c.seo, c.created_at, c.updated_at
ORDER BY c.display_name ASC, c.slug ASC;

\echo '--- storefront editorial sections batch query ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, category_slug, section_type, position, payload, published
FROM editorial_sections
WHERE category_slug = ANY(ARRAY['shop-men', 'atelier-women'])
  AND published = true
ORDER BY category_slug ASC, position ASC, id ASC;

\echo '--- storefront featured products batch query ---'
EXPLAIN (ANALYZE, BUFFERS)
SELECT
    fp.id,
    fp.product_external_id,
    fp.category_slug,
    fp.position,
    p.id,
    COALESCE(p.external_id, ''),
    p.name,
    p.description,
    p.price,
    p.stock,
    p.category,
    COALESCE(p.category_slug, ''),
    p.brand,
    p.material,
    p.tags,
    p.status,
    p.sku,
    p.variants,
    p.image_url,
    p.image_urls,
    p.merchandising_rank,
    p.created_at,
    p.updated_at
FROM featured_products fp
JOIN products p ON p.external_id = fp.product_external_id
WHERE fp.category_slug = ANY(ARRAY['shop-men', 'atelier-women'])
  AND p.status = 'active'
ORDER BY fp.category_slug ASC, fp.position ASC, p.updated_at DESC, p.id DESC;
