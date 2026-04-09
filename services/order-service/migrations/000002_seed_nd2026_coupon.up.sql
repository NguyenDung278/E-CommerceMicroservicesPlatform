INSERT INTO coupons (
    id,
    code,
    description,
    discount_type,
    discount_value,
    min_order_amount,
    usage_limit,
    used_count,
    active,
    expires_at,
    created_at,
    updated_at
)
VALUES (
    'c0a6e9d6-7f34-4e0d-8f6e-1b8b73c42026',
    'ND2026',
    'Auto checkout promotion: 25% off the entire order total.',
    'percentage',
    25,
    0,
    0,
    0,
    TRUE,
    NULL,
    NOW(),
    NOW()
)
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description,
    discount_type = EXCLUDED.discount_type,
    discount_value = EXCLUDED.discount_value,
    min_order_amount = EXCLUDED.min_order_amount,
    active = EXCLUDED.active,
    updated_at = NOW();
