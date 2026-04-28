import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CreditCard, Ticket, Truck } from "lucide-react";
import { EmptyView, ErrorView, LoadingView } from "../components/status-view";
import { listPublicCoupons } from "../services/coupon-service";
import { createOrder, previewOrder } from "../services/order-service";
import { processPayment, type ProcessPaymentRequest } from "../services/payment-service";
import { listAddresses } from "../services/user-service";
import { useAuth } from "../state/auth-context";
import { useCart } from "../state/cart-context";
import type {
  Address,
  CouponWalletItem,
  CreateOrderRequest,
  Order,
  OrderPreview,
  Payment,
  ShippingAddress,
} from "../types/api";
import { formatCurrency } from "../utils/format";

const basicShippingMethods = [
  {
    method: "standard",
    label: "Giao tiêu chuẩn",
    description: "Phù hợp cho đơn hàng thông thường.",
    eta_label: "Đang tính ETA",
  },
  {
    method: "express",
    label: "Giao nhanh",
    description: "Ưu tiên xử lý và bàn giao vận chuyển.",
    eta_label: "Đang tính ETA",
  },
  {
    method: "pickup",
    label: "Nhận tại điểm lấy hàng",
    description: "Không cần nhập địa chỉ giao hàng.",
    eta_label: "Sẵn sàng theo xác nhận",
  },
];

const paymentMethods: Array<{
  value: ProcessPaymentRequest["payment_method"];
  label: string;
  description: string;
}> = [
  { value: "demo", label: "Demo", description: "Xử lý ngay trong môi trường local" },
  { value: "momo", label: "MoMo", description: "Mở cổng thanh toán nếu gateway trả URL" },
  { value: "manual", label: "Thủ công", description: "Ghi nhận theo quy trình nội bộ" },
  { value: "credit_card", label: "Thẻ", description: "Thanh toán bằng thẻ" },
  { value: "digital_wallet", label: "Ví điện tử", description: "Thanh toán bằng ví số" },
];

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
  const [coupons, setCoupons] = useState<CouponWalletItem[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
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
  const shippingOptions =
    preview?.supported_shipping_methods && preview.supported_shipping_methods.length > 0
      ? preview.supported_shipping_methods
      : basicShippingMethods;
  const couponSubtotal = preview?.subtotal_price ?? cart?.total ?? 0;

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

  useEffect(() => {
    let active = true;

    async function loadCoupons() {
      if (!cart || cart.items.length === 0) {
        setCoupons([]);
        return;
      }

      try {
        setCouponsLoading(true);
        const data = await listPublicCoupons(couponSubtotal);
        if (active) {
          setCoupons(data);
        }
      } catch {
        if (active) {
          setCoupons([]);
        }
      } finally {
        if (active) {
          setCouponsLoading(false);
        }
      }
    }

    void loadCoupons();

    return () => {
      active = false;
    };
  }, [cart, couponSubtotal]);

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

  function selectCoupon(code: string) {
    setCouponCode((current) => (current === code ? "" : code));
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
            <div className="inline-actions">
              <Link className="button button--secondary" to={`/account/orders/${order.id}`}>
                Xem chi tiết đơn
              </Link>
              {payment ? (
                <Link className="button button--secondary" to={`/payments/${payment.id}`}>
                  Theo dõi thanh toán
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <form className="checkout-layout" onSubmit={handleSubmit}>
          <div className="checkout-form">
            <section className="checkout-step">
              <div className="checkout-step__heading">
                <Truck size={20} />
                <div>
                  <span className="eyebrow">Shipping</span>
                  <h2>Chọn phương thức giao hàng</h2>
                </div>
              </div>
              <div className="shipping-option-grid">
                {shippingOptions.map((option) => (
                  <button
                    key={option.method}
                    className={`shipping-option-card${
                      shippingMethod === option.method ? " is-selected" : ""
                    }`}
                    type="button"
                    onClick={() => setShippingMethod(option.method)}
                  >
                    <span className="shipping-option-card__check">
                      {shippingMethod === option.method ? <CheckCircle2 size={17} /> : null}
                    </span>
                    <strong>{option.label}</strong>
                    <p>{option.description}</p>
                    <small>{option.eta_label}</small>
                    {"fee" in option ? <b>{formatCurrency(option.fee)}</b> : <b>Đang tính phí</b>}
                  </button>
                ))}
              </div>
            </section>

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

            <section className="checkout-step">
              <div className="checkout-step__heading">
                <Ticket size={20} />
                <div>
                  <span className="eyebrow">Coupon</span>
                  <h2>Mã giảm giá</h2>
                </div>
              </div>
              <div className="coupon-selector">
                <div className="coupon-selector__row">
                  <input
                    value={couponCode}
                    placeholder="Nhập mã coupon"
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  />
                  {couponCode ? (
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => setCouponCode("")}
                    >
                      Xóa
                    </button>
                  ) : null}
                </div>
                {preview?.coupon_code ? (
                  <div className="coupon-applied">
                    <CheckCircle2 size={17} />
                    <div>
                      <strong>{preview.coupon_code}</strong>
                      <p>{preview.coupon_description || "Đã áp dụng mã giảm giá"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="muted-text">Mã hợp lệ sẽ được xác nhận trong phần tóm tắt đơn.</p>
                )}
                {couponsLoading ? <p className="muted-text">Đang tải ví voucher...</p> : null}
                {coupons.length > 0 ? (
                  <div className="coupon-wallet-list">
                    {coupons.map((coupon) => (
                      <button
                        key={coupon.code}
                        className={`coupon-wallet-card${
                          couponCode === coupon.code ? " is-selected" : ""
                        }`}
                        type="button"
                        disabled={!coupon.eligible}
                        onClick={() => selectCoupon(coupon.code)}
                      >
                        <div>
                          <strong>{coupon.code}</strong>
                          <p>{coupon.description || "Voucher khả dụng"}</p>
                          {!coupon.eligible && coupon.ineligible_reason ? (
                            <small>{coupon.ineligible_reason}</small>
                          ) : null}
                        </div>
                        <span>
                          {coupon.eligible
                            ? `Giảm khoảng ${formatCurrency(coupon.estimated_discount)}`
                            : `Tối thiểu ${formatCurrency(coupon.min_order_amount)}`}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="checkout-step">
              <div className="checkout-step__heading">
                <CreditCard size={20} />
                <div>
                  <span className="eyebrow">Payment</span>
                  <h2>Phương thức thanh toán</h2>
                </div>
              </div>
              <div className="payment-method-grid">
                {paymentMethods.map((method) => (
                  <button
                    key={method.value}
                    className={`payment-method-card${
                      paymentMethod === method.value ? " is-selected" : ""
                    }`}
                    type="button"
                    onClick={() => setPaymentMethod(method.value)}
                  >
                    <strong>{method.label}</strong>
                    <p>{method.description}</p>
                  </button>
                ))}
              </div>
            </section>
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
