import { Link } from "react-router-dom";
import { useCart } from "../state/cart-context";
import type { Product } from "../types/api";
import { getProductImage } from "../utils/format";
import { PriceLabel } from "./price-label";
import { ProductImage } from "./product-image";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const isUnavailable = product.status !== "active" || product.stock <= 0;

  return (
    <article className="product-card">
      <Link to={`/products/${product.id}`} className="product-card__image-link">
        <ProductImage src={getProductImage(product)} alt={product.name} />
      </Link>

      <div className="product-card__body">
        <Link to={`/products/${product.id}`} className="product-card__name">
          {product.name}
        </Link>
        {product.description ? (
          <p className="product-card__description">{product.description}</p>
        ) : null}
        <div className="product-card__meta">
          <PriceLabel value={product.price} />
          {product.brand ? <span>{product.brand}</span> : null}
        </div>
        <button
          className="button button--primary product-card__button"
          type="button"
          disabled={isUnavailable}
          onClick={() => void addItem(product.id)}
        >
          {isUnavailable ? "Tạm hết hàng" : "Thêm vào giỏ"}
        </button>
      </div>
    </article>
  );
}
