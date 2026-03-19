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
  return (
    <article className="product-card">
      <div className="product-card-head">
        <span className="product-category">{product.category || "general"}</span>
        <span className={`stock-chip${product.stock === 0 ? " stock-chip-empty" : ""}`}>
          Tồn kho: {product.stock}
        </span>
      </div>

      <h3>{product.name}</h3>
      <p className="product-description">{product.description || "Không có mô tả sản phẩm."}</p>

      <div className="product-price-row">
        <strong>${product.price.toFixed(2)}</strong>
        <Link className="text-link" to={`/products/${product.id}`}>
          Xem chi tiết
        </Link>
      </div>

      <div className="product-actions">
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
