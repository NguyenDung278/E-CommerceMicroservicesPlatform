import { Link } from "react-router-dom";

import type { Product } from "../../types/api";
import { formatCurrency } from "../../utils/format";
import "./ProductCard.css";

type ProductCardProps = {
  product: Product;
  onAddToCart?: (product: Product) => void | Promise<void>;
  onBuyNow?: (product: Product) => void | Promise<void>;
  busy?: boolean;
  variant?: "default" | "archive";
  adminAction?: {
    label: string;
    onClick: (product: Product) => void | Promise<void>;
    danger?: boolean;
    busy?: boolean;
  };
  secondaryAdminAction?: {
    label: string;
    onClick: (product: Product) => void | Promise<void>;
    danger?: boolean;
    busy?: boolean;
  };
};

export function ProductCard({
  product,
  onAddToCart,
  onBuyNow,
  busy = false,
  variant = "default",
  adminAction,
  secondaryAdminAction
}: ProductCardProps) {
  const isAdminCard = Boolean(adminAction || secondaryAdminAction);
  const productImages = Array.isArray(product.image_urls)
    ? product.image_urls
    : product.image_url
      ? [product.image_url]
      : [];
  const productTags = Array.isArray(product.tags) ? product.tags : [];
  const productVariants = Array.isArray(product.variants) ? product.variants : [];
  const productPrice = Number.isFinite(product.price) ? product.price : 0;
  const primaryImage = productImages[0] ?? "";
  const accentTag = productTags[0] ?? "";
  const stockLabel = product.stock === 0 ? "Hết hàng" : `${product.stock} còn lại`;
  const stockSignalClassName =
    product.stock === 0 || product.stock <= 2
      ? "product-card-archive-signal product-card-archive-signal-alert"
      : "product-card-archive-signal";

  if (variant === "archive") {
    return (
      <article className="product-card-archive">
        <div className="product-card-archive-media-shell">
          <Link className="product-card-archive-media" to={`/products/${product.id}`}>
            {primaryImage ? (
              <img alt={product.name} src={primaryImage} />
            ) : (
              <div className="product-card-archive-fallback">{product.name.slice(0, 1).toUpperCase()}</div>
            )}
          </Link>

          {accentTag ? <span className="product-card-archive-badge">#{accentTag}</span> : null}

          {onAddToCart ? (
            <button
              className="product-card-archive-action"
              disabled={busy || product.stock === 0}
              aria-label={`Thêm ${product.name} vào giỏ hàng`}
              type="button"
              onClick={() => void onAddToCart(product)}
            >
              {busy ? "..." : "+"}
            </button>
          ) : null}
        </div>

        <div className="product-card-archive-copy">
          <div className="product-card-archive-head">
            <h3>
              <Link to={`/products/${product.id}`}>{product.name}</Link>
            </h3>
            <strong>{formatCurrency(productPrice)}</strong>
          </div>

          <p className="product-card-archive-subtitle">{product.brand || product.category || "ND Atelier"}</p>

          <div className={stockSignalClassName}>
            <span className="product-card-archive-dot" aria-hidden="true" />
            <span>
              {product.stock === 0
                ? "Out of stock"
                : product.stock <= 2
                  ? "Low stock - real-time sync"
                  : "In stock - ready to ship"}
            </span>
          </div>

          {onBuyNow ? (
            <div className="product-card-archive-links">
              <Link className="text-link" to={`/products/${product.id}`}>
                Xem chi tiết
              </Link>
              <button className="catalog-archive-buy-link" type="button" onClick={() => void onBuyNow(product)}>
                Mua ngay
              </button>
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className={isAdminCard ? "product-card product-card-admin-shell" : "product-card product-card-editorial"}>
      <div className="product-card-media-shell">
        <Link className="product-card-media-link" to={`/products/${product.id}`}>
          {primaryImage ? (
            <div className="product-card-media">
              <img alt={product.name} src={primaryImage} />
            </div>
          ) : (
            <div className="product-card-media product-card-media-fallback">
              <span>{product.name.slice(0, 1).toUpperCase()}</span>
            </div>
          )}
        </Link>

        <div className="product-card-badge-row">
          <span className="product-card-badge">{product.category || "atelier item"}</span>
          {accentTag ? <span className="product-card-badge product-card-badge-muted">#{accentTag}</span> : null}
        </div>
      </div>

      <div className="product-card-copy">
        <div className="product-card-head">
          <div className="product-card-title-block">
            <span className="product-card-brand">{product.brand || "ND Atelier"}</span>
            <h3>{product.name}</h3>
          </div>
          <span className={`stock-chip${product.stock === 0 ? " stock-chip-empty" : ""}`}>{stockLabel}</span>
        </div>

        <div className="product-meta-row">
          <span>{product.status || "active"}</span>
          <span>{product.sku || "SKU pending"}</span>
        </div>

        <p className="product-description">{product.description || "Không có mô tả sản phẩm."}</p>

        <p className="product-card-collection">
          {product.category || "Curated collection"} • {product.brand || "ND Atelier"} •{" "}
          {productVariants.length > 0 ? `${productVariants.length} biến thể live` : stockLabel}
        </p>

        {productTags.length > 1 ? (
          <div className="product-tag-row">
            {productTags.slice(1, 4).map((tag) => (
              <span className="product-tag-chip" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        {productVariants.length > 0 ? (
          <p className="product-variant-summary">{productVariants.length} biến thể SKU khả dụng</p>
        ) : null}

        <div className="product-price-row">
          <div className="product-price-block">
            <strong>{formatCurrency(productPrice)}</strong>
            <span>{product.category || "General collection"}</span>
          </div>
          <Link className="text-link" to={`/products/${product.id}`}>
            Xem chi tiết
          </Link>
        </div>
      </div>

      <div className={isAdminCard ? "product-actions product-actions-admin" : "product-actions"}>
        {onAddToCart ? (
          <button
            className="primary-button"
            disabled={busy || product.stock === 0}
            onClick={() => void onAddToCart(product)}
            type="button"
          >
            {busy ? "Đang thêm..." : "Thêm vào giỏ"}
          </button>
        ) : null}
        {onBuyNow ? (
          <button
            className="ghost-button"
            disabled={product.stock === 0}
            onClick={() => void onBuyNow(product)}
            type="button"
          >
            Mua ngay
          </button>
        ) : null}
        {adminAction ? (
          <button
            className={adminAction.danger ? "danger-button" : "ghost-button"}
            disabled={adminAction.busy}
            onClick={() => void adminAction.onClick(product)}
            type="button"
          >
            {adminAction.busy ? "Đang xử lý..." : adminAction.label}
          </button>
        ) : null}
        {secondaryAdminAction ? (
          <button
            className={secondaryAdminAction.danger ? "danger-button" : "ghost-button"}
            disabled={secondaryAdminAction.busy}
            onClick={() => void secondaryAdminAction.onClick(product)}
            type="button"
          >
            {secondaryAdminAction.busy ? "Đang xử lý..." : secondaryAdminAction.label}
          </button>
        ) : null}
      </div>
    </article>
  );
}
