import type {
  Address,
  Cart,
  CartItem,
  EmailVerificationChallenge,
  JsonObject,
  JsonValue,
  NotificationInboxItem,
  NotificationPreference,
  Order,
  OrderEvent,
  OrderPaymentsSummary,
  OrderItem,
  OrderPreview,
  Payment,
  PhoneVerificationChallenge,
  Product,
  ProductPopularity,
  ProductRatingBreakdown,
  ProductReview,
  ProductReviewList,
  ProductReviewSummary,
  ProductSearchClickAnalyticsEntry,
  ProductSearchAssist,
  ProductSearchAnalyticsEntry,
  ProductSearchFilterAnalyticsEntry,
  ProductSearchAnalyticsSummary,
  ProductSearchFacet,
  ProductSearchFacetValue,
  ProductSearchSortOption,
  ProductSearchSuggestion,
  ProductVariant,
  ProfileAddressInput,
  ReturnEvent,
  ReturnEvidence,
  ReturnEligibilityItem,
  ReturnEligibilitySnapshot,
  ReturnItem,
  ReturnRequest,
  ShippingAddress,
  ShippingOption,
  StorefrontCategory,
  StorefrontCategoryPageData,
  StorefrontEditorialSection,
  StorefrontFeaturedProduct,
  StorefrontProduct,
  UserProfile,
  WishlistAlert,
  WishlistItem,
} from "@/types/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function normalizeJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJsonValue(entry));
  }

  if (isRecord(value)) {
    return normalizeJsonObject(value);
  }

  return null;
}

function normalizeJsonObject(value: unknown): JsonObject {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<JsonObject>((result, [key, entry]) => {
    result[key] = normalizeJsonValue(entry);
    return result;
  }, {});
}

export function normalizeProductVariant(value: unknown): ProductVariant {
  const variant = isRecord(value) ? value : {};

  return {
    sku: normalizeString(variant.sku),
    label: normalizeString(variant.label),
    size: normalizeString(variant.size) || undefined,
    color: normalizeString(variant.color) || undefined,
    price: normalizeNumber(variant.price),
    stock: normalizeNumber(variant.stock),
  };
}

export function normalizeProduct(value: unknown): Product {
  const product = isRecord(value) ? value : {};

  return {
    id: normalizeString(product.id),
    name: normalizeString(product.name),
    description: normalizeString(product.description),
    price: normalizeNumber(product.price),
    stock: normalizeNumber(product.stock),
    category: normalizeString(product.category),
    brand: normalizeString(product.brand),
    tags: Array.isArray(product.tags)
      ? product.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
      : [],
    status: normalizeString(product.status),
    sku: normalizeString(product.sku),
    variants: Array.isArray(product.variants)
      ? product.variants.map((item) => normalizeProductVariant(item))
      : [],
    image_url: normalizeString(product.image_url),
    image_urls: Array.isArray(product.image_urls)
      ? product.image_urls.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
      : [],
    created_at: normalizeString(product.created_at),
    updated_at: normalizeString(product.updated_at),
  };
}

export function normalizeStorefrontProduct(value: unknown): StorefrontProduct {
  const product = isRecord(value) ? value : {};
  const normalizedProduct = normalizeProduct(product);

  return {
    ...normalizedProduct,
    external_id: normalizeString(product.external_id),
    category_slug: normalizeString(product.category_slug) || undefined,
    material: normalizeString(product.material),
    merchandising_rank: normalizeNumber(product.merchandising_rank),
  };
}

export function normalizeProductList(value: unknown): Product[] {
  return Array.isArray(value) ? value.map((item) => normalizeProduct(item)) : [];
}

export function normalizeProductSearchSuggestion(value: unknown): ProductSearchSuggestion {
  const suggestion = isRecord(value) ? value : {};

  return {
    value: normalizeString(suggestion.value),
    kind: normalizeString(suggestion.kind),
    match_count: normalizeNumber(suggestion.match_count),
  };
}

export function normalizeProductSearchFacetValue(value: unknown): ProductSearchFacetValue {
  const facetValue = isRecord(value) ? value : {};

  return {
    value: normalizeString(facetValue.value),
    count: normalizeNumber(facetValue.count),
  };
}

export function normalizeProductSearchFacet(value: unknown): ProductSearchFacet {
  const facet = isRecord(value) ? value : {};

  return {
    key: normalizeString(facet.key),
    label: normalizeString(facet.label),
    values: Array.isArray(facet.values)
      ? facet.values.map((entry) => normalizeProductSearchFacetValue(entry))
      : [],
  };
}

export function normalizeProductSearchSortOption(value: unknown): ProductSearchSortOption {
  const sortOption = isRecord(value) ? value : {};

  return {
    value: normalizeString(sortOption.value),
    label: normalizeString(sortOption.label),
  };
}

export function normalizeProductSearchAssist(value: unknown): ProductSearchAssist {
  const assist = isRecord(value) ? value : {};

  return {
    query: normalizeString(assist.query),
    resolved_query: normalizeString(assist.resolved_query),
    applied_synonyms: Array.isArray(assist.applied_synonyms)
      ? assist.applied_synonyms.filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
        )
      : [],
    result_count: normalizeNumber(assist.result_count),
    suggestions: Array.isArray(assist.suggestions)
      ? assist.suggestions.map((entry) => normalizeProductSearchSuggestion(entry))
      : [],
    facets: Array.isArray(assist.facets)
      ? assist.facets.map((entry) => normalizeProductSearchFacet(entry))
      : [],
    sort_options: Array.isArray(assist.sort_options)
      ? assist.sort_options.map((entry) => normalizeProductSearchSortOption(entry))
      : [],
  };
}

export function normalizeStorefrontCategory(value: unknown): StorefrontCategory {
  const category = isRecord(value) ? value : {};

  return {
    slug: normalizeString(category.slug),
    display_name: normalizeString(category.display_name),
    nav_label: normalizeString(category.nav_label),
    status: normalizeString(category.status),
    hero: normalizeJsonObject(category.hero),
    filter_config: Array.isArray(category.filter_config)
      ? category.filter_config.map((entry) => normalizeJsonValue(entry))
      : [],
    seo: normalizeJsonObject(category.seo),
    aliases: Array.isArray(category.aliases)
      ? category.aliases.filter((alias): alias is string => typeof alias === "string" && alias.trim().length > 0)
      : [],
    created_at: normalizeString(category.created_at),
    updated_at: normalizeString(category.updated_at),
  };
}

export function normalizeStorefrontCategoryList(value: unknown): StorefrontCategory[] {
  return Array.isArray(value) ? value.map((entry) => normalizeStorefrontCategory(entry)) : [];
}

export function normalizeStorefrontEditorialSection(value: unknown): StorefrontEditorialSection {
  const section = isRecord(value) ? value : {};

  return {
    id: normalizeString(section.id),
    category_slug: normalizeString(section.category_slug),
    section_type: normalizeString(section.section_type),
    position: normalizeNumber(section.position),
    payload: normalizeJsonObject(section.payload),
    published: normalizeBoolean(section.published),
  };
}

export function normalizeStorefrontFeaturedProduct(value: unknown): StorefrontFeaturedProduct {
  const featuredProduct = isRecord(value) ? value : {};

  return {
    id: normalizeString(featuredProduct.id),
    product_external_id: normalizeString(featuredProduct.product_external_id),
    category_slug: normalizeString(featuredProduct.category_slug),
    position: normalizeNumber(featuredProduct.position),
    product: normalizeStorefrontProduct(featuredProduct.product),
  };
}

export function normalizeStorefrontCategoryPageData(value: unknown): StorefrontCategoryPageData {
  const pageData = isRecord(value) ? value : {};

  return {
    category: normalizeStorefrontCategory(pageData.category),
    sections: Array.isArray(pageData.sections)
      ? pageData.sections.map((entry) => normalizeStorefrontEditorialSection(entry))
      : [],
    featured_products: Array.isArray(pageData.featured_products)
      ? pageData.featured_products.map((entry) => normalizeStorefrontFeaturedProduct(entry))
      : [],
  };
}

function normalizeProductRatingBreakdown(value: unknown): ProductRatingBreakdown {
  const breakdown = isRecord(value) ? value : {};

  return {
    one: normalizeNumber(breakdown.one),
    two: normalizeNumber(breakdown.two),
    three: normalizeNumber(breakdown.three),
    four: normalizeNumber(breakdown.four),
    five: normalizeNumber(breakdown.five),
  };
}

export function normalizeProductReviewSummary(value: unknown): ProductReviewSummary {
  const summary = isRecord(value) ? value : {};

  return {
    average_rating: normalizeNumber(summary.average_rating),
    review_count: normalizeNumber(summary.review_count),
    rating_breakdown: normalizeProductRatingBreakdown(summary.rating_breakdown),
  };
}

export function normalizeProductReview(value: unknown): ProductReview {
  const review = isRecord(value) ? value : {};

  return {
    id: normalizeString(review.id),
    product_id: normalizeString(review.product_id),
    user_id: normalizeString(review.user_id),
    author_label: normalizeString(review.author_label),
    rating: normalizeNumber(review.rating),
    comment: normalizeString(review.comment),
    created_at: normalizeString(review.created_at),
    updated_at: normalizeString(review.updated_at),
  };
}

export function normalizeProductReviewList(value: unknown): ProductReviewList {
  const reviewList = isRecord(value) ? value : {};

  return {
    summary: normalizeProductReviewSummary(reviewList.summary),
    items: Array.isArray(reviewList.items)
      ? reviewList.items.map((item) => normalizeProductReview(item))
      : [],
  };
}

export function normalizeAddress(value: unknown): Address {
  const address = isRecord(value) ? value : {};

  return {
    id: normalizeString(address.id),
    user_id: normalizeString(address.user_id),
    recipient_name: normalizeString(address.recipient_name),
    phone: normalizeString(address.phone),
    location: normalizeString(address.location),
    is_default: normalizeBoolean(address.is_default),
    created_at: normalizeString(address.created_at),
    updated_at: normalizeString(address.updated_at),
  };
}

export function normalizeAddressList(value: unknown): Address[] {
  return Array.isArray(value) ? value.map((item) => normalizeAddress(item)) : [];
}

export function normalizeWishlistItem(value: unknown): WishlistItem {
  const item = isRecord(value) ? value : {};

  return {
    user_id: normalizeString(item.user_id),
    product_id: normalizeString(item.product_id),
    created_at: normalizeString(item.created_at),
    updated_at: normalizeString(item.updated_at),
  };
}

export function normalizeWishlistItemList(value: unknown): WishlistItem[] {
  return Array.isArray(value) ? value.map((item) => normalizeWishlistItem(item)) : [];
}

export function normalizeWishlistAlert(value: unknown): WishlistAlert {
  const alert = isRecord(value) ? value : {};

  return {
    product_id: normalizeString(alert.product_id),
    product_name: normalizeString(alert.product_name) || undefined,
    kind: normalizeString(alert.kind),
    baseline_price:
      typeof alert.baseline_price === "number" && Number.isFinite(alert.baseline_price)
        ? alert.baseline_price
        : undefined,
    current_price:
      typeof alert.current_price === "number" && Number.isFinite(alert.current_price)
        ? alert.current_price
        : undefined,
    baseline_stock:
      typeof alert.baseline_stock === "number" && Number.isFinite(alert.baseline_stock)
        ? alert.baseline_stock
        : undefined,
    current_stock:
      typeof alert.current_stock === "number" && Number.isFinite(alert.current_stock)
        ? alert.current_stock
        : undefined,
    detected_at: normalizeString(alert.detected_at),
  };
}

export function normalizeWishlistAlertList(value: unknown): WishlistAlert[] {
  return Array.isArray(value) ? value.map((item) => normalizeWishlistAlert(item)) : [];
}

export function normalizeNotificationPreference(value: unknown): NotificationPreference {
  const preference = isRecord(value) ? value : {};

  return {
    user_id: normalizeString(preference.user_id),
    topic: normalizeString(preference.topic),
    enabled: normalizeBoolean(preference.enabled),
    updated_at: normalizeString(preference.updated_at),
  };
}

export function normalizeNotificationPreferenceList(value: unknown): NotificationPreference[] {
  return Array.isArray(value)
    ? value.map((item) => normalizeNotificationPreference(item))
    : [];
}

export function normalizeNotificationInboxItem(value: unknown): NotificationInboxItem {
  const item = isRecord(value) ? value : {};

  return {
    id: normalizeString(item.id),
    user_id: normalizeString(item.user_id),
    topic: normalizeString(item.topic),
    routing_key: normalizeString(item.routing_key),
    delivery_status: normalizeString(item.delivery_status),
    visible_to_user:
      item.visible_to_user === undefined ? undefined : normalizeBoolean(item.visible_to_user),
    attempt_count:
      item.attempt_count === undefined ? undefined : normalizeNumber(item.attempt_count),
    last_error: normalizeString(item.last_error) || undefined,
    next_retry_at: normalizeString(item.next_retry_at) || undefined,
    title: normalizeString(item.title),
    message: normalizeString(item.message),
    action_href: normalizeString(item.action_href) || undefined,
    action_label: normalizeString(item.action_label) || undefined,
    order_id: normalizeString(item.order_id) || undefined,
    payment_id: normalizeString(item.payment_id) || undefined,
    return_id: normalizeString(item.return_id) || undefined,
    created_at: normalizeString(item.created_at),
    read_at: normalizeString(item.read_at) || undefined,
  };
}

export function normalizeNotificationInboxList(value: unknown): NotificationInboxItem[] {
  return Array.isArray(value) ? value.map((item) => normalizeNotificationInboxItem(item)) : [];
}

export function normalizeShippingAddress(value: unknown): ShippingAddress | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    recipient_name: normalizeString(value.recipient_name),
    phone: normalizeString(value.phone),
    location: normalizeString(value.location),
  };
}

export function normalizeCartItem(value: unknown): CartItem {
  const item = isRecord(value) ? value : {};

  return {
    product_id: normalizeString(item.product_id),
    name: normalizeString(item.name),
    price: normalizeNumber(item.price),
    quantity: normalizeNumber(item.quantity),
  };
}

export function normalizeCart(value: unknown): Cart {
  const cart = isRecord(value) ? value : {};
  const items = Array.isArray(cart.items) ? cart.items.map((item) => normalizeCartItem(item)) : [];

  return {
    user_id: normalizeString(cart.user_id),
    items,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  };
}

export function normalizeOrderItem(value: unknown): OrderItem {
  const item = isRecord(value) ? value : {};

  return {
    id: normalizeString(item.id),
    order_id: normalizeString(item.order_id),
    product_id: normalizeString(item.product_id),
    name: normalizeString(item.name),
    price: normalizeNumber(item.price),
    quantity: normalizeNumber(item.quantity),
  };
}

export function normalizeOrder(value: unknown): Order {
  const order = isRecord(value) ? value : {};

  return {
    id: normalizeString(order.id),
    user_id: normalizeString(order.user_id),
    status: normalizeString(order.status),
    subtotal_price: normalizeNumber(order.subtotal_price),
    discount_amount: normalizeNumber(order.discount_amount),
    coupon_code: normalizeString(order.coupon_code) || undefined,
    shipping_method: normalizeString(order.shipping_method),
    shipping_fee: normalizeNumber(order.shipping_fee),
    shipping_address: normalizeShippingAddress(order.shipping_address),
    total_price: normalizeNumber(order.total_price),
    items: Array.isArray(order.items) ? order.items.map((item) => normalizeOrderItem(item)) : [],
    created_at: normalizeString(order.created_at),
    updated_at: normalizeString(order.updated_at),
  };
}

export function normalizeOrderList(value: unknown): Order[] {
  return Array.isArray(value) ? value.map((item) => normalizeOrder(item)) : [];
}

export function normalizeOrderEvent(value: unknown): OrderEvent {
  const event = isRecord(value) ? value : {};

  return {
    id: normalizeString(event.id),
    order_id: normalizeString(event.order_id),
    type: normalizeString(event.type),
    status: normalizeString(event.status),
    actor_id: normalizeString(event.actor_id) || undefined,
    actor_role: normalizeString(event.actor_role) || undefined,
    message: normalizeString(event.message),
    created_at: normalizeString(event.created_at),
  };
}

export function normalizeOrderEventList(value: unknown): OrderEvent[] {
  return Array.isArray(value) ? value.map((item) => normalizeOrderEvent(item)) : [];
}

export function normalizeReturnItem(value: unknown): ReturnItem {
  const item = isRecord(value) ? value : {};

  return {
    id: normalizeString(item.id),
    return_id: normalizeString(item.return_id),
    order_item_id: normalizeString(item.order_item_id),
    product_id: normalizeString(item.product_id),
    quantity: normalizeNumber(item.quantity),
    reason: normalizeString(item.reason) || undefined,
    created_at: normalizeString(item.created_at),
    updated_at: normalizeString(item.updated_at),
  };
}

export function normalizeReturnEvent(value: unknown): ReturnEvent {
  const event = isRecord(value) ? value : {};

  return {
    id: normalizeString(event.id),
    return_id: normalizeString(event.return_id),
    status: normalizeString(event.status),
    actor_id: normalizeString(event.actor_id) || undefined,
    actor_role: normalizeString(event.actor_role) || undefined,
    message: normalizeString(event.message),
    created_at: normalizeString(event.created_at),
  };
}

export function normalizeReturnEvidence(value: unknown): ReturnEvidence {
  const evidence = isRecord(value) ? value : {};

  return {
    id: normalizeString(evidence.id),
    return_id: normalizeString(evidence.return_id),
    file_name: normalizeString(evidence.file_name),
    content_type: normalizeString(evidence.content_type),
    size_bytes: normalizeNumber(evidence.size_bytes),
    url: normalizeString(evidence.url),
    uploaded_by: normalizeString(evidence.uploaded_by) || undefined,
    uploaded_by_role: normalizeString(evidence.uploaded_by_role) || undefined,
    created_at: normalizeString(evidence.created_at),
  };
}

export function normalizeReturnRequest(value: unknown): ReturnRequest {
  const request = isRecord(value) ? value : {};

  return {
    id: normalizeString(request.id),
    order_id: normalizeString(request.order_id),
    user_id: normalizeString(request.user_id),
    user_email: normalizeString(request.user_email) || undefined,
    status: normalizeString(request.status),
    reason: normalizeString(request.reason),
    items: Array.isArray(request.items)
      ? request.items.map((item) => normalizeReturnItem(item))
      : [],
    events: Array.isArray(request.events)
      ? request.events.map((event) => normalizeReturnEvent(event))
      : [],
    evidence: Array.isArray(request.evidence)
      ? request.evidence.map((entry) => normalizeReturnEvidence(entry))
      : [],
    refund_amount:
      typeof request.refund_amount === "number" && Number.isFinite(request.refund_amount)
        ? request.refund_amount
        : undefined,
    refund_charge_payment_id:
      normalizeString(request.refund_charge_payment_id) || undefined,
    refund_payment_id: normalizeString(request.refund_payment_id) || undefined,
    refund_last_error: normalizeString(request.refund_last_error) || undefined,
    refund_attempt_count:
      typeof request.refund_attempt_count === "number" &&
      Number.isFinite(request.refund_attempt_count)
        ? request.refund_attempt_count
        : undefined,
    refund_requested_at: normalizeString(request.refund_requested_at) || undefined,
    refund_completed_at: normalizeString(request.refund_completed_at) || undefined,
    refund_next_retry_at: normalizeString(request.refund_next_retry_at) || undefined,
    created_at: normalizeString(request.created_at),
    updated_at: normalizeString(request.updated_at),
  };
}

export function normalizeReturnRequestList(value: unknown): ReturnRequest[] {
  return Array.isArray(value) ? value.map((item) => normalizeReturnRequest(item)) : [];
}

export function normalizeReturnEligibilityItem(value: unknown): ReturnEligibilityItem {
  const item = isRecord(value) ? value : {};

  return {
    order_item_id: normalizeString(item.order_item_id),
    product_id: normalizeString(item.product_id),
    product_name: normalizeString(item.product_name),
    ordered_quantity: normalizeNumber(item.ordered_quantity),
    already_requested_quantity: normalizeNumber(item.already_requested_quantity),
    remaining_quantity: normalizeNumber(item.remaining_quantity),
    eligible: normalizeBoolean(item.eligible),
    reason: normalizeString(item.reason) || undefined,
  };
}

export function normalizeReturnEligibilitySnapshot(value: unknown): ReturnEligibilitySnapshot {
  const snapshot = isRecord(value) ? value : {};

  return {
    order_id: normalizeString(snapshot.order_id),
    order_status: normalizeString(snapshot.order_status),
    eligible: normalizeBoolean(snapshot.eligible),
    reason: normalizeString(snapshot.reason) || undefined,
    return_window_days: normalizeNumber(snapshot.return_window_days),
    return_window_started_at: normalizeString(snapshot.return_window_started_at) || undefined,
    return_window_expires_at: normalizeString(snapshot.return_window_expires_at) || undefined,
    items: Array.isArray(snapshot.items)
      ? snapshot.items.map((item) => normalizeReturnEligibilityItem(item))
      : [],
  };
}

export function normalizeOrderPreview(value: unknown): OrderPreview {
  const preview = isRecord(value) ? value : {};

  return {
    subtotal_price: normalizeNumber(preview.subtotal_price),
    discount_amount: normalizeNumber(preview.discount_amount),
    coupon_code: normalizeString(preview.coupon_code) || undefined,
    coupon_description: normalizeString(preview.coupon_description) || undefined,
    shipping_method: normalizeString(preview.shipping_method),
    shipping_fee: normalizeNumber(preview.shipping_fee),
    eta_label: normalizeString(preview.eta_label) || undefined,
    delivery_promise: normalizeString(preview.delivery_promise) || undefined,
    supported_shipping_methods: Array.isArray(preview.supported_shipping_methods)
      ? preview.supported_shipping_methods.map((item) => normalizeShippingOption(item))
      : [],
    total_price: normalizeNumber(preview.total_price),
  };
}

export function normalizeShippingOption(value: unknown): ShippingOption {
  const option = isRecord(value) ? value : {};

  return {
    method: normalizeString(option.method),
    label: normalizeString(option.label),
    description: normalizeString(option.description) || undefined,
    fee: normalizeNumber(option.fee),
    eta_min_days: normalizeNumber(option.eta_min_days),
    eta_max_days: normalizeNumber(option.eta_max_days),
    eta_label: normalizeString(option.eta_label),
    delivery_promise: normalizeString(option.delivery_promise),
  };
}

export function normalizePayment(value: unknown): Payment {
  const payment = isRecord(value) ? value : {};

  return {
    id: normalizeString(payment.id),
    order_id: normalizeString(payment.order_id),
    user_id: normalizeString(payment.user_id),
    order_total: normalizeNumber(payment.order_total),
    amount: normalizeNumber(payment.amount),
    status: normalizeString(payment.status),
    transaction_type: normalizeString(payment.transaction_type),
    reference_payment_id: normalizeString(payment.reference_payment_id) || undefined,
    payment_method: normalizeString(payment.payment_method),
    gateway_provider: normalizeString(payment.gateway_provider),
    gateway_transaction_id: normalizeString(payment.gateway_transaction_id) || undefined,
    gateway_order_id: normalizeString(payment.gateway_order_id) || undefined,
    checkout_url: normalizeString(payment.checkout_url) || undefined,
    signature_verified: normalizeBoolean(payment.signature_verified),
    failure_reason: normalizeString(payment.failure_reason) || undefined,
    net_paid_amount: typeof payment.net_paid_amount === "number" ? payment.net_paid_amount : undefined,
    outstanding_amount: typeof payment.outstanding_amount === "number" ? payment.outstanding_amount : undefined,
    created_at: normalizeString(payment.created_at),
    updated_at: normalizeString(payment.updated_at),
  };
}

export function normalizePaymentList(value: unknown): Payment[] {
  return Array.isArray(value) ? value.map((item) => normalizePayment(item)) : [];
}

export function normalizeOrderPaymentsSummary(value: unknown): OrderPaymentsSummary {
  const summary = isRecord(value) ? value : {};
  const paymentsByOrderSource = isRecord(summary.payments_by_order)
    ? summary.payments_by_order
    : isRecord(summary.paymentsByOrder)
      ? summary.paymentsByOrder
      : {};

  return {
    orders: normalizeOrderList(summary.orders),
    paymentsByOrder: Object.fromEntries(
      Object.entries(paymentsByOrderSource).map(([orderId, payments]) => [
        orderId,
        normalizePaymentList(payments),
      ]),
    ),
  };
}

export function normalizeProductSearchAnalyticsEntry(
  value: unknown,
): ProductSearchAnalyticsEntry {
  const entry = isRecord(value) ? value : {};

  return {
    query: normalizeString(entry.query),
    source: normalizeString(entry.source),
    category: normalizeString(entry.category) || undefined,
    request_count: normalizeNumber(entry.request_count),
    zero_result_count: normalizeNumber(entry.zero_result_count),
    average_result_count: normalizeNumber(entry.average_result_count),
    last_seen_at: normalizeString(entry.last_seen_at),
  };
}

export function normalizeProductSearchClickAnalyticsEntry(
  value: unknown,
): ProductSearchClickAnalyticsEntry {
  const entry = isRecord(value) ? value : {};

  return {
    query: normalizeString(entry.query),
    source: normalizeString(entry.source),
    category: normalizeString(entry.category) || undefined,
    click_count: normalizeNumber(entry.click_count),
    last_seen_at: normalizeString(entry.last_seen_at),
  };
}

export function normalizeProductSearchFilterAnalyticsEntry(
  value: unknown,
): ProductSearchFilterAnalyticsEntry {
  const entry = isRecord(value) ? value : {};

  return {
    source: normalizeString(entry.source),
    category: normalizeString(entry.category) || undefined,
    filter_key: normalizeString(entry.filter_key),
    filter_value: normalizeString(entry.filter_value),
    apply_count: normalizeNumber(entry.apply_count),
    last_seen_at: normalizeString(entry.last_seen_at),
  };
}

export function normalizeProductSearchAnalyticsSummary(
  value: unknown,
): ProductSearchAnalyticsSummary {
  const summary = isRecord(value) ? value : {};

  return {
    window_days: normalizeNumber(summary.window_days),
    top_queries: Array.isArray(summary.top_queries)
      ? summary.top_queries.map((entry) => normalizeProductSearchAnalyticsEntry(entry))
      : [],
    zero_result_queries: Array.isArray(summary.zero_result_queries)
      ? summary.zero_result_queries.map((entry) => normalizeProductSearchAnalyticsEntry(entry))
      : [],
    top_clicked_queries: Array.isArray(summary.top_clicked_queries)
      ? summary.top_clicked_queries.map((entry) =>
          normalizeProductSearchClickAnalyticsEntry(entry)
        )
      : [],
    top_filters: Array.isArray(summary.top_filters)
      ? summary.top_filters.map((entry) => normalizeProductSearchFilterAnalyticsEntry(entry))
      : [],
  };
}

export function normalizeUserProfile(value: unknown): UserProfile {
  const user = isRecord(value) ? value : {};

  return {
    id: normalizeString(user.id),
    email: normalizeString(user.email),
    phone: normalizeString(user.phone) || undefined,
    phone_verified: normalizeBoolean(user.phone_verified),
    phone_verified_at: normalizeString(user.phone_verified_at) || undefined,
    first_name: normalizeString(user.first_name),
    last_name: normalizeString(user.last_name),
    role: normalizeString(user.role),
    email_verified: normalizeBoolean(user.email_verified),
    created_at: normalizeString(user.created_at),
    updated_at: normalizeString(user.updated_at),
  };
}

export function normalizeUserProfileList(value: unknown): UserProfile[] {
  return Array.isArray(value) ? value.map((item) => normalizeUserProfile(item)) : [];
}

export function normalizeProfileAddressInput(value: unknown): ProfileAddressInput {
  const address = isRecord(value) ? value : {};

  return {
    recipient_name: normalizeString(address.recipient_name),
    phone: normalizeString(address.phone),
    location: normalizeString(address.location),
  };
}

export function normalizePhoneVerificationChallenge(value: unknown): PhoneVerificationChallenge | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    verification_id: normalizeString(value.verification_id),
    phone: normalizeString(value.phone),
    phone_masked: normalizeString(value.phone_masked),
    status: normalizeString(value.status),
    expires_at: normalizeString(value.expires_at) || undefined,
    resend_available_at: normalizeString(value.resend_available_at) || undefined,
    expires_in_seconds: normalizeNumber(value.expires_in_seconds),
    resend_in_seconds: normalizeNumber(value.resend_in_seconds),
    max_attempts: normalizeNumber(value.max_attempts),
    remaining_attempts: normalizeNumber(value.remaining_attempts),
    verified_at: normalizeString(value.verified_at) || undefined,
  };
}

export function normalizeEmailVerificationChallenge(value: unknown): EmailVerificationChallenge | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    verification_id: normalizeString(value.verification_id),
    email: normalizeString(value.email),
    email_masked: normalizeString(value.email_masked),
    status: normalizeString(value.status),
    expires_at: normalizeString(value.expires_at) || undefined,
    resend_available_at: normalizeString(value.resend_available_at) || undefined,
    expires_in_seconds: normalizeNumber(value.expires_in_seconds),
    resend_in_seconds: normalizeNumber(value.resend_in_seconds),
    max_attempts: normalizeNumber(value.max_attempts),
    remaining_attempts: normalizeNumber(value.remaining_attempts),
    verified_at: normalizeString(value.verified_at) || undefined,
  };
}

export function normalizeProductPopularity(value: unknown): ProductPopularity {
  const popularity = isRecord(value) ? value : {};

  return {
    product_id: normalizeString(popularity.product_id),
    quantity: normalizeNumber(popularity.quantity),
  };
}
