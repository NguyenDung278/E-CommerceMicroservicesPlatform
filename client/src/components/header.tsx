import { Heart, Search, ShoppingCart, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { getSearchAssist } from "../services/product-service";
import { useAuth } from "../state/auth-context";
import { useCart } from "../state/cart-context";
import { useWishlist } from "../state/wishlist-context";
import type { ProductSearchAssist } from "../types/api";

export function Header() {
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get("search") ?? "");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart } = useCart();
  const { items: wishlistItems } = useWishlist();
  const [assist, setAssist] = useState<ProductSearchAssist | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const totalItems = cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
  const suggestions = assist?.suggestions ?? [];

  useEffect(() => {
    const query = keyword.trim();
    if (query.length < 2) {
      setAssist(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      void getSearchAssist(query)
        .then(setAssist)
        .catch(() => setAssist(null));
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [keyword]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = keyword.trim();
    setSearchFocused(false);
    navigate(query ? `/products?search=${encodeURIComponent(query)}` : "/products");
  }

  function chooseSuggestion(value: string) {
    setKeyword(value);
    setSearchFocused(false);
    navigate(`/products?search=${encodeURIComponent(value)}`);
  }

  return (
    <header className="site-header">
      <div className="site-header__top">
        <Link to="/" className="brand">
          ND Shop
        </Link>

        <div className="search-shell">
          <form className="search-bar" onSubmit={handleSearch}>
            <Search size={18} />
            <input
              value={keyword}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 160)}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm sản phẩm"
              aria-label="Tìm sản phẩm"
            />
            <button type="submit">Tìm</button>
          </form>
          {searchFocused && suggestions.length > 0 ? (
            <div className="search-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.kind}-${suggestion.value}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseSuggestion(suggestion.value)}
                >
                  <Search size={15} />
                  <span>{suggestion.value}</span>
                  <small>{suggestion.match_count}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="header-actions">
          <Link to="/cart" className="header-action" aria-label="Giỏ hàng">
            <ShoppingCart size={21} />
            {totalItems > 0 ? <span className="header-action__badge">{totalItems}</span> : null}
          </Link>
          <Link to="/account#wishlist" className="header-action" aria-label="Wishlist">
            <Heart size={21} />
            {wishlistItems.length > 0 ? (
              <span className="header-action__badge">{wishlistItems.length}</span>
            ) : null}
          </Link>
          <Link to="/account" className="header-action" aria-label="Tài khoản">
            <UserRound size={21} />
            <span>{user ? user.first_name || user.email : "Đăng nhập"}</span>
          </Link>
        </div>
      </div>

      <nav className="site-nav" aria-label="Điều hướng chính">
        <NavLink to="/">Trang chủ</NavLink>
        <NavLink to="/products">Sản phẩm</NavLink>
        <NavLink to="/cart">Giỏ hàng</NavLink>
        <NavLink to="/checkout">Thanh toán</NavLink>
        <NavLink to="/account">Tài khoản</NavLink>
      </nav>
    </header>
  );
}
