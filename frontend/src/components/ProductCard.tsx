import { Link } from "react-router-dom";

import type { Product } from "../types/api";

type ProductCardProps = {
  product: Product;
  onAddToCart?: (product: Product) => void | Promise<void>;
  onBuyNow?: (product: Product) => void;
  busy?: boolean;
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

  return (
    <article className={isAdminCard ? "product-card product-card-admin-shell" : "product-card product-card-editorial"}>
      <div className="product-card-media-shell">
        {primaryImage ? (
          <div className="product-card-media">
            <img alt={product.name} src={primaryImage} />
          </div>
        ) : (
          <div className="product-card-media product-card-media-fallback">
            <span>{product.name.slice(0, 1).toUpperCase()}</span>
          </div>
        )}

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
            <strong>${productPrice.toFixed(2)}</strong>
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
            onClick={() => onBuyNow(product)}
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
