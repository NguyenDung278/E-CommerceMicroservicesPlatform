import { Link } from "react-router-dom";
import { PriceLabel } from "../components/price-label";
import { QuantityControl } from "../components/quantity-control";
import { EmptyView, LoadingView } from "../components/status-view";
import { useAuth } from "../state/auth-context";
import { useCart } from "../state/cart-context";
import { formatCurrency } from "../utils/format";

export function CartPage() {
  const { token } = useAuth();
  const { cart, loading, error, updateItem, removeItem, clearCart } = useCart();

  if (!token) {
    return (
      <EmptyView title="Cần đăng nhập">
      </EmptyView>
    );
  }

  if (loading) {
    return <LoadingView label="Đang tải giỏ hàng" />;
  }

  const items = cart?.items ?? [];

  return (
    <div className="page-stack">
      <section className="surface-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Cart</span>
            <h1>Giỏ hàng</h1>
          </div>
          {items.length > 0 ? (
            <button className="button button--ghost" type="button" onClick={() => void clearCart()}>
              Xóa giỏ hàng
            </button>
          ) : null}
        </div>

        {error ? <p className="inline-error">{error}</p> : null}

        {items.length === 0 ? (
          <EmptyView title="Giỏ hàng đang trống">
            Chọn sản phẩm từ danh sách rồi thêm vào giỏ.
          </EmptyView>
        ) : (
          <div className="cart-layout">
            <div className="cart-list">
              {items.map((item) => (
                <article key={item.product_id} className="cart-item">
                  <div>
                    <Link to={`/products/${item.product_id}`} className="cart-item__name">
                      {item.name}
                    </Link>
                    <PriceLabel value={item.price} />
                  </div>
                  <QuantityControl
                    value={item.quantity}
                    onChange={(quantity) => void updateItem(item.product_id, quantity)}
                  />
                  <strong>{formatCurrency(item.price * item.quantity)}</strong>
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => void removeItem(item.product_id)}
                  >
                    Xóa
                  </button>
                </article>
              ))}
            </div>

            <aside className="summary-card">
              <span className="eyebrow">Tổng thanh toán</span>
              <strong>{formatCurrency(cart?.total ?? 0)}</strong>
              <Link className="button button--primary" to="/checkout">
                Tiến hành thanh toán
              </Link>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
