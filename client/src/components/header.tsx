import { Search, ShoppingCart, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../state/auth-context";
import { useCart } from "../state/cart-context";

export function Header() {
  const [searchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get("search") ?? "");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart } = useCart();
  const totalItems = cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = keyword.trim();
    navigate(query ? `/products?search=${encodeURIComponent(query)}` : "/products");
  }

  return (
    <header className="site-header">
      <div className="site-header__top">
        <Link to="/" className="brand">
          ND Shop
        </Link>

        <form className="search-bar" onSubmit={handleSearch}>
          <Search size={18} />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm sản phẩm"
            aria-label="Tìm sản phẩm"
          />
          <button type="submit">Tìm</button>
        </form>

        <div className="header-actions">
          <Link to="/cart" className="header-action" aria-label="Giỏ hàng">
            <ShoppingCart size={21} />
            {totalItems > 0 ? <span className="header-action__badge">{totalItems}</span> : null}
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
