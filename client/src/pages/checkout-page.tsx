import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyView, ErrorView, LoadingView } from "../components/status-view";
import { createOrder, previewOrder } from "../services/order-service";
import { processPayment, type ProcessPaymentRequest } from "../services/payment-service";
import { listAddresses } from "../services/user-service";
import { useAuth } from "../state/auth-context";
import { useCart } from "../state/cart-context";
import type {
  Address,
  CreateOrderRequest,
  Order,
  OrderPreview,
  Payment,
  ShippingAddress,
} from "../types/api";
import { formatCurrency } from "../utils/format";

const initialAddress: ShippingAddress = {
  recipient_name: "",
  phone: "",
  location: "",
};

export function CheckoutPage() {
  const { token } = useAuth();
  const { cart, loading: cartLoading, refreshCart } = useCart();
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [shippingAddress, setShippingAddress] = useState(initialAddress);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<ProcessPaymentRequest["payment_method"]>("demo");
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items =
    cart?.items.map((item) => ({
      product_id: item.product_id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })) ?? [];

  useEffect(() => {
    let active = true;

    async function loadAddresses() {
      if (!token) {
        setAddresses([]);
        return;
      }

      const data = await listAddresses(token).catch(() => []);
      if (!active) {
        return;
      }

      setAddresses(data);
      const defaultAddress = data.find((address) => address.is_default) ?? data[0];
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
        setShippingAddress({
          recipient_name: defaultAddress.recipient_name,
          phone: defaultAddress.phone,
          location: defaultAddress.location,
        });
      }
    }

    void loadAddresses();

    return () => {
      active = false;
    };
  }, [token]);

  function buildPayload(): CreateOrderRequest {
    return {
      items,
      coupon_code: couponCode.trim() || undefined,
      shipping_method: shippingMethod,
      shipping_address: shippingMethod === "pickup" ? undefined : shippingAddress,
    };
  }

  function chooseSavedAddress(addressId: string) {
    setSelectedAddressId(addressId);
    const address = addresses.find((item) => item.id === addressId);
    if (!address) {
      return;
    }

    setShippingAddress({
      recipient_name: address.recipient_name,
      phone: address.phone,
      location: address.location,
    });
  }

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      const previewItems =
        cart?.items.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })) ?? [];

      if (!token || previewItems.length === 0) {
        setPreview(null);
        return;
      }

      try {
        setLoadingPreview(true);
        setError(null);
        const data = await previewOrder(token, {
          items: previewItems,
          coupon_code: couponCode.trim() || undefined,
          shipping_method: shippingMethod,
          shipping_address: shippingMethod === "pickup" ? undefined : shippingAddress,
        });
        if (active) {
          setPreview(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tạo được báo giá đơn hàng");
        }
      } finally {
        if (active) {
          setLoadingPreview(false);
        }
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [cart, couponCode, shippingAddress, shippingMethod, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("Bạn cần đăng nhập để tạo đơn hàng");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const createdOrder = await createOrder(token, buildPayload());
      const createdPayment = await processPayment(token, {
        order_id: createdOrder.id,
        payment_method: paymentMethod,
        amount: createdOrder.total_price,
      });
      setOrder(createdOrder);
      setPayment(createdPayment);
      await refreshCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được đơn hàng");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return <EmptyView title="Cần đăng nhập"></EmptyView>;
  }

  if (cartLoading) {
    return <LoadingView label="Đang tải dữ liệu thanh toán" />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyView title="Chưa có sản phẩm để thanh toán">
        <Link to="/products">Quay lại danh sách sản phẩm</Link>
      </EmptyView>
    );
  }

  return (
    <div className="page-stack">
      <section className="surface-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Checkout</span>
            <h1>Thanh toán</h1>
          </div>
        </div>

        {error ? <ErrorView message={error} /> : null}
        {order ? (
          <div className="success-card">
            <h2>Đã tạo đơn hàng</h2>
            <p>Mã đơn: {order.id}</p>
            {payment ? (
              <p>
                Payment: {payment.status}
                {payment.checkout_url ? (
                  <>
                    {" "}
                    <a href={payment.checkout_url}>Mở cổng thanh toán</a>
                  </>
                ) : null}
              </p>
            ) : null}
            <Link className="button button--secondary" to="/account/orders">
              Xem đơn hàng
            </Link>
          </div>
        ) : null}

        <form className="checkout-layout" onSubmit={handleSubmit}>
          <div className="checkout-form">
            <label>
              Phương thức giao hàng
              <select
                value={shippingMethod}
                onChange={(event) => setShippingMethod(event.target.value)}
              >
                <option value="standard">Giao tiêu chuẩn</option>
                <option value="express">Giao nhanh</option>
                <option value="pickup">Nhận tại điểm lấy hàng</option>
              </select>
            </label>

            {shippingMethod !== "pickup" ? (
              <>
                {addresses.length > 0 ? (
                  <label>
                    Địa chỉ đã lưu
                    <select
                      value={selectedAddressId}
                      onChange={(event) => chooseSavedAddress(event.target.value)}
                    >
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.recipient_name} - {address.location}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="form-grid">
                  <label>
                    Người nhận
                    <input
                      value={shippingAddress.recipient_name}
                      onChange={(event) =>
                        setShippingAddress((current) => ({
                          ...current,
                          recipient_name: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label>
                    Số điện thoại
                    <input
                      value={shippingAddress.phone}
                      onChange={(event) =>
                        setShippingAddress((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="form-grid__wide">
                    Địa chỉ
                    <input
                      value={shippingAddress.location}
                      onChange={(event) =>
                        setShippingAddress((current) => ({
                          ...current,
                          location: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </div>
              </>
            ) : null}

            <label>
              Mã giảm giá
              <input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} />
            </label>
            <label>
              Phương thức thanh toán
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as ProcessPaymentRequest["payment_method"])
                }
              >
                <option value="demo">Demo</option>
                <option value="momo">MoMo</option>
                <option value="manual">Thanh toán thủ công</option>
                <option value="credit_card">Thẻ</option>
                <option value="digital_wallet">Ví điện tử</option>
              </select>
            </label>
          </div>

          <aside className="summary-card">
            <span className="eyebrow">Tóm tắt</span>
            {loadingPreview ? <p>Đang tính tổng...</p> : null}
            <div className="summary-row">
              <span>Tạm tính</span>
              <strong>{formatCurrency(preview?.subtotal_price ?? cart.total)}</strong>
            </div>
            <div className="summary-row">
              <span>Giảm giá</span>
              <strong>{formatCurrency(preview?.discount_amount ?? 0)}</strong>
            </div>
            <div className="summary-row">
              <span>Phí giao hàng</span>
              <strong>{formatCurrency(preview?.shipping_fee ?? 0)}</strong>
            </div>
            <div className="summary-row summary-row--total">
              <span>Tổng</span>
              <strong>{formatCurrency(preview?.total_price ?? cart.total)}</strong>
            </div>
            <button className="button button--primary" type="submit" disabled={submitting}>
              {submitting ? "Đang tạo đơn" : "Tạo đơn hàng"}
            </button>
          </aside>
        </form>
      </section>
    </div>
  );
}
