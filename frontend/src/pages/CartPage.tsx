import { Link } from "react-router-dom";

import { useCart } from "../hooks/useCart";
import { getErrorMessage } from "../lib/api";

export function CartPage() {
  const { cart, clearCart, error, removeItem, updateItem, isLoading } = useCart();

  async function handleQuantityChange(productId: string, nextQuantity: number) {
    try {
      if (nextQuantity <= 0) {
        await removeItem(productId);
        return;
      }
      await updateItem(productId, nextQuantity);
    } catch (reason) {
      alert(getErrorMessage(reason));
    }
  }

  async function handleClearCart() {
    try {
      await clearCart();
    } catch (reason) {
      alert(getErrorMessage(reason));
    }
  }

  return (
    <div className="page-stack">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Giỏ hàng</span>
            <h1>Giỏ hàng của bạn</h1>
          </div>
        </div>

        {error ? <div className="feedback feedback-error">{error}</div> : null}

        {isLoading ? <div className="page-state">Đang tải giỏ hàng...</div> : null}

        {cart.items.length === 0 ? (
          <div className="empty-card">
            <h2>Giỏ hàng đang trống</h2>
            <p>Hãy thêm sản phẩm từ catalog trước khi thanh toán.</p>
            <Link className="primary-link" to="/products">
              Đi đến catalog
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="card">
              <div className="cart-items">
                {cart.items.map((item) => (
                  <article className="cart-item" key={item.product_id}>
                    <div>
                      <h3>{item.name}</h3>
                      <p>${item.price.toFixed(2)}</p>
                    </div>
                    <div className="cart-item-actions">
                      <input
                        min="1"
                        step="1"
                        type="number"
                        value={item.quantity}
                        onChange={(event) =>
                          void handleQuantityChange(
                            item.product_id,
                            Number.parseInt(event.target.value, 10) || 1
                          )
                        }
                      />
                      <button className="ghost-button" onClick={() => void removeItem(item.product_id)} type="button">
                        Xóa
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="summary-panel">
              <h2>Tổng kết</h2>
              <div className="summary-row">
                <span>Số mặt hàng</span>
                <strong>{cart.items.length}</strong>
              </div>
              <div className="summary-row">
                <span>Tổng tiền</span>
                <strong>${cart.total.toFixed(2)}</strong>
              </div>
              <div className="summary-actions">
                <Link className="primary-link" to="/checkout">
                  Đi đến checkout
                </Link>
                <button className="danger-button" onClick={() => void handleClearCart()} type="button">
                  Xóa giỏ hàng
                </button>
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
