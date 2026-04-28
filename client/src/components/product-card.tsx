import { Heart } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth-context";
import { useCart } from "../state/cart-context";
import { useWishlist } from "../state/wishlist-context";
import type { Product } from "../types/api";
import { getProductImage } from "../utils/format";
import { PriceLabel } from "./price-label";
import { ProductImage } from "./product-image";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { isWishlisted, toggleItem, updatingProductIds } = useWishlist();
  const isUnavailable = product.status !== "active" || product.stock <= 0;
  const wishlisted = isWishlisted(product.id);
  const wishlistBusy = updatingProductIds.includes(product.id);

  function handleWishlistToggle() {
    if (!user) {
      navigate("/account", {
        state: { authError: "Bạn cần đăng nhập để lưu sản phẩm yêu thích" },
      });
      return;
    }

    void toggleItem(product.id);
  }

  return (
    <article className="product-card">
      <button
        className={`product-card__wishlist${wishlisted ? " is-active" : ""}`}
        type="button"
        aria-label={wishlisted ? "Bỏ khỏi wishlist" : "Thêm vào wishlist"}
        title={wishlisted ? "Bỏ khỏi wishlist" : "Thêm vào wishlist"}
        disabled={wishlistBusy}
        onClick={handleWishlistToggle}
      >
        <Heart size={18} fill={wishlisted ? "currentColor" : "none"} />
      </button>
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
