import { Link } from "react-router-dom";

/** Footer điều hướng: chỉ link tới các route thật của app. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <span className="brand">ND Shop</span>
          <p>Mua sắm — theo dõi đơn — thanh toán — đổi trả trong một nơi.</p>
        </div>
        <nav className="site-footer__column" aria-label="Mua sắm">
          <strong>Mua sắm</strong>
          <Link to="/products">Tất cả sản phẩm</Link>
          <Link to="/cart">Giỏ hàng</Link>
          <Link to="/checkout">Thanh toán</Link>
        </nav>
        <nav className="site-footer__column" aria-label="Tài khoản">
          <strong>Tài khoản</strong>
          <Link to="/account">Hồ sơ của tôi</Link>
          <Link to="/account#orders">Đơn hàng</Link>
          <Link to="/account/returns">Trả hàng / hoàn tiền</Link>
          <Link to="/account#notifications">Thông báo</Link>
        </nav>
      </div>
      <div className="site-footer__legal">© {new Date().getFullYear()} ND Shop</div>
    </footer>
  );
}
