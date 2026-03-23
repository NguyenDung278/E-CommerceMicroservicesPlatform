import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { FormField } from "../components/FormField";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Address, Order, OrderPreview, Payment, ShippingAddress } from "../types/api";
import { formatCurrency, formatShippingMethodLabel } from "../utils/format";
import { sanitizeText } from "../utils/sanitize";
import { validatePayment } from "../utils/validation";
import "./checkout.css";

type DirectProductState = {
  directProduct?: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  };
};

type ShippingMethod = "standard" | "express" | "pickup";

type AddressFormState = {
  recipient_name: string;
  phone: string;
  street: string;
  ward: string;
  district: string;
  city: string;
};

const shippingMethodOptions: Array<{ value: ShippingMethod; hint: string }> = [
  { value: "standard", hint: "Miễn phí cho đơn từ $100, còn lại $5.99." },
  { value: "express", hint: "Ưu tiên đóng gói và giao nhanh với phí $14.99." },
  { value: "pickup", hint: "Nhận tại quầy, không phát sinh phí vận chuyển." }
];

const emptyAddressForm: AddressFormState = {
  recipient_name: "",
  phone: "",
  street: "",
  ward: "",
  district: "",
  city: ""
};

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, isAuthenticated } = useAuth();
  const { cart, clearCart } = useCart();

  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [latestPayment, setLatestPayment] = useState<Payment | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<OrderPreview | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isBusy, setIsBusy] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("standard");
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [isCreatingAddress, setIsCreatingAddress] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressFormState>(emptyAddressForm);

  const directProduct = (location.state as DirectProductState | null)?.directProduct;

  const draftItems = directProduct
    ? [
        {
          product_id: directProduct.id,
          quantity: directProduct.quantity,
          name: directProduct.name,
          price: directProduct.price
        }
      ]
    : cart.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        name: item.name,
        price: item.price
      }));

  const checkoutItems = latestOrder
    ? latestOrder.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        name: item.name,
        price: item.price
      }))
    : draftItems;

  const draftSignature = useMemo(
    () => draftItems.map((item) => `${item.product_id}:${item.quantity}`).join("|"),
    [draftItems]
  );

  useEffect(() => {
    if (!latestOrder) {
      setCouponPreview(null);
    }
  }, [draftSignature, latestOrder]);

  useEffect(() => {
    let active = true;

    if (!token) {
      setAddresses([]);
      setSelectedAddressId("");
      setIsLoadingAddresses(false);
      return () => {
        active = false;
      };
    }

    setIsLoadingAddresses(true);

    void api
      .listAddresses(token)
      .then((response) => {
        if (!active) {
          return;
        }

        setAddresses(response.data);
        const defaultAddress = response.data.find((item) => item.is_default) ?? response.data[0];
        setSelectedAddressId(defaultAddress?.id ?? "");
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingAddresses(false);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  const localSubtotal = draftItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedAddress = addresses.find((address) => address.id === selectedAddressId) ?? null;
  const shippingAddress = toShippingAddress(selectedAddress);
  const pricingSummary = latestOrder
    ? {
        subtotal_price: latestOrder.subtotal_price,
        discount_amount: latestOrder.discount_amount,
        coupon_code: latestOrder.coupon_code,
        shipping_fee: latestOrder.shipping_fee,
        shipping_method: latestOrder.shipping_method,
        total_price: latestOrder.total_price
      }
    : couponPreview;
  const shippingFee = pricingSummary?.shipping_fee ?? estimateShippingFee(localSubtotal, shippingMethod);
  const computedTotal =
    pricingSummary?.total_price ??
    Math.max(0, localSubtotal - (pricingSummary?.discount_amount ?? 0) + shippingFee);
  const outstandingPaymentAmount =
    latestPayment && typeof latestPayment.outstanding_amount === "number"
      ? latestPayment.outstanding_amount
      : latestOrder?.total_price ?? computedTotal;
  const itemCount = checkoutItems.reduce((sum, item) => sum + item.quantity, 0);
  const activeShippingHint =
    shippingMethodOptions.find((option) => option.value === (pricingSummary?.shipping_method ?? shippingMethod))
      ?.hint ?? "Chọn phương án giao phù hợp để kiểm tra đầy đủ order summary và payment flow.";
  const checkoutStageLabel = latestPayment
    ? latestPayment.status === "pending"
      ? "Pending gateway"
      : outstandingPaymentAmount <= 0
        ? "Paid"
        : "Payment recorded"
    : latestOrder
      ? "Ready for payment"
      : "Draft order";
  const heroMetrics = [
    {
      label: "Items in flow",
      value: `${itemCount}`,
      description: latestOrder ? "Đang snapshot theo order đã tạo." : "Lấy từ cart hoặc buy-now state."
    },
    {
      label: "Shipping mode",
      value: formatShippingMethodLabel(pricingSummary?.shipping_method ?? shippingMethod),
      description: activeShippingHint
    },
    {
      label: "Outstanding",
      value: formatCurrency(outstandingPaymentAmount),
      description: latestOrder ? "Số tiền còn lại cần xử lý ở payment step." : "Ước tính để chuẩn bị checkout."
    }
  ];
  const guideSteps = [
    {
      title: "1. Shipping",
      description:
        shippingMethod === "pickup"
          ? "Đơn hiện đang ở chế độ nhận tại quầy nên không cần snapshot địa chỉ."
          : "Chọn địa chỉ hoặc tạo địa chỉ mới để snapshot thông tin giao vào order."
    },
    {
      title: "2. Pricing",
      description: latestOrder
        ? "Subtotal, discount và shipping fee đã được cố định trong order hiện tại."
        : "Bạn có thể preview voucher trước khi commit sang bước tạo order."
    },
    {
      title: "3. Payment",
      description: latestOrder
        ? "Chọn gateway và thanh toán từng phần hoặc toàn bộ từ panel bên phải."
        : "Payment form sẽ mở khi order đã được tạo thành công."
    }
  ];

  async function handleCreateOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAuthenticated || !token) {
      navigate("/login", { state: { from: location } });
      return;
    }

    if (latestOrder) {
      setFeedback("Đơn hàng đã được tạo. Bạn có thể tiếp tục thanh toán ngay bên phải.");
      return;
    }

    if (draftItems.length === 0) {
      setFeedback("Không có sản phẩm nào để checkout.");
      return;
    }
    if (shippingMethod !== "pickup" && !shippingAddress) {
      setFeedback("Hãy chọn hoặc tạo địa chỉ giao hàng trước khi tạo đơn.");
      return;
    }

    try {
      setIsBusy("order");
      const normalizedCouponCode = couponCode.trim();
      const response = await api.createOrder(token, {
        items: draftItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity
        })),
        coupon_code: normalizedCouponCode || undefined,
        shipping_method: shippingMethod,
        shipping_address: shippingMethod === "pickup" ? undefined : shippingAddress ?? undefined
      });
      setLatestOrder(response.data);
      if (response.data.coupon_code) {
        setCouponCode(response.data.coupon_code);
      }
      setLatestPayment(null);
      setFeedback(`Đã tạo đơn hàng ${response.data.id}. Bạn có thể thanh toán ngay bên dưới.`);

      if (!directProduct && cart.items.length > 0) {
        await clearCart();
      }
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsBusy("");
    }
  }

  async function handlePreviewCoupon() {
    const normalizedCouponCode = couponCode.trim();

    if (!isAuthenticated || !token) {
      navigate("/login", { state: { from: location } });
      return;
    }

    if (latestOrder) {
      setFeedback("Voucher đã được khóa theo đơn hàng vừa tạo.");
      return;
    }

    if (!normalizedCouponCode) {
      setFeedback("Nhập mã voucher trước khi áp dụng.");
      return;
    }

    if (draftItems.length === 0) {
      setFeedback("Không có sản phẩm nào để kiểm tra voucher.");
      return;
    }
    if (shippingMethod !== "pickup" && !shippingAddress) {
      setFeedback("Hãy chọn địa chỉ giao hàng trước khi xem trước tổng tiền.");
      return;
    }

    try {
      setIsBusy("preview");
      const response = await api.previewOrder(token, {
        items: draftItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity
        })),
        coupon_code: normalizedCouponCode,
        shipping_method: shippingMethod,
        shipping_address: shippingMethod === "pickup" ? undefined : shippingAddress ?? undefined
      });
      setCouponPreview(response.data);
      setCouponCode(response.data.coupon_code ?? normalizedCouponCode.toUpperCase());
      setFeedback(`Voucher ${response.data.coupon_code ?? normalizedCouponCode.toUpperCase()} hợp lệ cho đơn hiện tại.`);
    } catch (reason) {
      setCouponPreview(null);
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsBusy("");
    }
  }

  function handleClearCoupon() {
    if (latestOrder) {
      setFeedback("Voucher đã được gắn với đơn hàng vừa tạo và không thể gỡ tại bước này.");
      return;
    }

    setCouponCode("");
    setCouponPreview(null);
    setFeedback("");
  }

  async function handleCreateAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      navigate("/login", { state: { from: location } });
      return;
    }

    const payload = {
      recipient_name: sanitizeText(addressForm.recipient_name),
      phone: sanitizeText(addressForm.phone),
      street: sanitizeText(addressForm.street),
      ward: sanitizeText(addressForm.ward),
      district: sanitizeText(addressForm.district),
      city: sanitizeText(addressForm.city),
      is_default: addresses.length === 0
    };

    if (!payload.recipient_name || !payload.phone || !payload.street || !payload.district || !payload.city) {
      setFeedback("Điền đủ tên người nhận, số điện thoại, đường, quận/huyện và tỉnh/thành.");
      return;
    }

    try {
      setIsCreatingAddress(true);
      const response = await api.createAddress(token, payload);
      setAddresses((current) => {
        const next = current.filter((item) => item.id !== response.data.id);
        return [response.data, ...next];
      });
      setSelectedAddressId(response.data.id);
      setAddressForm(emptyAddressForm);
      setShowAddressForm(false);
      setFeedback("Đã thêm địa chỉ giao hàng mới cho lần checkout này.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsCreatingAddress(false);
    }
  }

  async function handleProcessPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!latestOrder || !token) {
      setFeedback("Cần tạo đơn hàng trước khi thanh toán.");
      return;
    }

    const form = {
      orderId: latestOrder.id,
      paymentMethod,
      amount: paymentAmount
    };

    const errors = validatePayment(form);
    if (errors.length > 0) {
      setFeedback(errors.join(" "));
      return;
    }

    try {
      setIsBusy("payment");
      const response = await api.processPayment(token, {
        order_id: sanitizeText(latestOrder.id),
        payment_method: sanitizeText(paymentMethod),
        amount: paymentAmount ? Number.parseFloat(paymentAmount) : undefined
      });
      setLatestPayment(response.data);
      setPaymentAmount("");
      if (response.data.status === "pending") {
        setFeedback(
          `Giao dịch ${response.data.id} đang chờ callback từ ${response.data.gateway_provider}. Hệ thống sẽ cập nhật trạng thái khi webhook xác nhận.`
        );
      } else {
        setFeedback(
          `Đã ghi nhận giao dịch ${response.data.id}. Còn lại ${formatCurrency(response.data.outstanding_amount ?? 0)} để hoàn tất đơn hàng.`
        );
      }
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsBusy("");
    }
  }

  return (
    <div className="page-stack checkout-page">
      <section className="checkout-hero">
        <div className="checkout-hero-panel">
          <div className="checkout-hero-copy">
            <span className="eyebrow">Commerce Checkout</span>
            <h1>Hoàn tất đơn hàng với flow rõ bước, dễ test và giữ nguyên toàn bộ backend logic hiện có.</h1>
            <p>
              Màn checkout mới gom shipping, voucher, order snapshot và payment vào cùng một workbench để developer
              hoặc tester nhìn rõ trạng thái của đơn ở từng bước.
            </p>

            <div className="hero-actions">
              <Link className="primary-link" to={checkoutItems.length > 0 ? "/cart" : "/products"}>
                {checkoutItems.length > 0 ? "Xem giỏ hàng" : "Mở catalog"}
              </Link>
              <Link className="secondary-link" to="/payments">
                Lịch sử thanh toán
              </Link>
            </div>
          </div>

          <div className="checkout-hero-metrics">
            {heroMetrics.map((item) => (
              <article className="summary-card checkout-hero-metric" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="checkout-guide-card">
          <span className="section-kicker">Current Stage</span>
          <h2>{checkoutStageLabel}</h2>
          <p>
            {latestOrder
              ? "Order đã được tạo và pricing hiện đang được khóa theo snapshot ở backend."
              : "Bạn đang ở giai đoạn dựng order draft từ cart hoặc thao tác mua ngay."}
          </p>

          <div className="checkout-guide-list">
            {guideSteps.map((step) => (
              <article className="checkout-guide-step" key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.description}</span>
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="content-section checkout-workbench">
        <div className="section-heading checkout-heading">
          <div>
            <span className="section-kicker">Checkout Studio</span>
            <h2>Order build, review và payment</h2>
          </div>
          <span className="checkout-heading-caption">
            {directProduct ? "Buy-now flow" : "Cart checkout flow"} • {itemCount} item
            {itemCount === 1 ? "" : "s"}
          </span>
        </div>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        {!latestOrder && checkoutItems.length === 0 ? (
          <div className="empty-card checkout-empty-state">
            <span className="section-kicker">Nothing To Process</span>
            <h2>Không có sản phẩm để thanh toán</h2>
            <p>Bạn có thể quay lại catalog, thêm sản phẩm vào giỏ rồi quay lại đây để test full checkout flow.</p>
            <div className="hero-actions">
              <Link className="primary-link" to="/products">
                Mở catalog
              </Link>
              <Link className="secondary-link" to="/cart">
                Xem giỏ hàng
              </Link>
            </div>
          </div>
        ) : (
          <div className="checkout-shell-grid">
            <div className="checkout-stage-column">
              <article className="card checkout-stage-card">
                <div className="checkout-card-intro">
                  <span className="section-kicker">Shipping Setup</span>
                  <h2>Chọn cách fulfil và snapshot địa chỉ</h2>
                  <p>{activeShippingHint}</p>
                </div>

                <div className="checkout-form-block">
                  <h3>Phương thức vận chuyển</h3>
                  <div className="shipping-method-row">
                    {shippingMethodOptions.map((option) => (
                      <button
                        className={
                          shippingMethod === option.value
                            ? "filter-chip filter-chip-active"
                            : "filter-chip"
                        }
                        disabled={Boolean(latestOrder)}
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setShippingMethod(option.value);
                          setCouponPreview(null);
                        }}
                      >
                        {formatShippingMethodLabel(option.value)}
                      </button>
                    ))}
                  </div>
                  <p className="history-subtle">
                    {shippingMethodOptions.find((option) => option.value === shippingMethod)?.hint}
                  </p>
                </div>

                {shippingMethod !== "pickup" ? (
                  <div className="checkout-form-block">
                    <div className="checkout-section-head">
                      <div>
                        <h3>Địa chỉ giao hàng</h3>
                        <p className="history-subtle">
                          Địa chỉ được snapshot vào order để tránh lệch dữ liệu nếu bạn chỉnh hồ sơ sau đó.
                        </p>
                      </div>
                      {!latestOrder ? (
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => setShowAddressForm((current) => !current)}
                        >
                          {showAddressForm ? "Ẩn form địa chỉ" : "Thêm địa chỉ mới"}
                        </button>
                      ) : null}
                    </div>

                    {isLoadingAddresses ? <div className="page-state">Đang tải địa chỉ...</div> : null}

                    <div className="order-list checkout-address-list">
                      {addresses.map((address) => (
                        <button
                          className={
                            selectedAddressId === address.id
                              ? "address-option-card address-option-card-active"
                              : "address-option-card"
                          }
                          disabled={Boolean(latestOrder)}
                          key={address.id}
                          type="button"
                          onClick={() => {
                            setSelectedAddressId(address.id);
                            setCouponPreview(null);
                          }}
                        >
                          <strong>
                            {address.recipient_name}
                            {address.is_default ? " • Mặc định" : ""}
                          </strong>
                          <span>{address.phone}</span>
                          <span>{formatAddressLine(address)}</span>
                        </button>
                      ))}

                      {!isLoadingAddresses && addresses.length === 0 ? (
                        <p className="history-subtle">
                          Bạn chưa có địa chỉ giao hàng nào. Tạo nhanh ngay bên dưới để checkout.
                        </p>
                      ) : null}
                    </div>

                    {showAddressForm || addresses.length === 0 ? (
                      <form className="checkout-address-grid" onSubmit={handleCreateAddress}>
                        <div className="inline-grid">
                          <FormField htmlFor="checkout-address-recipient" label="Người nhận" required>
                            <input
                              id="checkout-address-recipient"
                              value={addressForm.recipient_name}
                              onChange={(event) =>
                                setAddressForm((current) => ({
                                  ...current,
                                  recipient_name: event.target.value
                                }))
                              }
                            />
                          </FormField>
                          <FormField htmlFor="checkout-address-phone" label="Số điện thoại" required>
                            <input
                              id="checkout-address-phone"
                              value={addressForm.phone}
                              onChange={(event) =>
                                setAddressForm((current) => ({ ...current, phone: event.target.value }))
                              }
                            />
                          </FormField>
                        </div>

                        <FormField htmlFor="checkout-address-street" label="Địa chỉ" required>
                          <input
                            id="checkout-address-street"
                            value={addressForm.street}
                            onChange={(event) =>
                              setAddressForm((current) => ({ ...current, street: event.target.value }))
                            }
                          />
                        </FormField>

                        <div className="inline-grid">
                          <FormField htmlFor="checkout-address-ward" label="Phường / Xã">
                            <input
                              id="checkout-address-ward"
                              value={addressForm.ward}
                              onChange={(event) =>
                                setAddressForm((current) => ({ ...current, ward: event.target.value }))
                              }
                            />
                          </FormField>
                          <FormField htmlFor="checkout-address-district" label="Quận / Huyện" required>
                            <input
                              id="checkout-address-district"
                              value={addressForm.district}
                              onChange={(event) =>
                                setAddressForm((current) => ({ ...current, district: event.target.value }))
                              }
                            />
                          </FormField>
                        </div>

                        <FormField htmlFor="checkout-address-city" label="Tỉnh / Thành phố" required>
                          <input
                            id="checkout-address-city"
                            value={addressForm.city}
                            onChange={(event) =>
                              setAddressForm((current) => ({ ...current, city: event.target.value }))
                            }
                          />
                        </FormField>

                        <button className="secondary-button" disabled={isCreatingAddress} type="submit">
                          {isCreatingAddress ? "Đang lưu địa chỉ..." : "Lưu địa chỉ này"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : (
                  <div className="payment-success checkout-inline-success">
                    <strong>Nhận tại quầy</strong>
                    <span>Đơn hàng sẽ không yêu cầu địa chỉ giao hàng và phí ship được tính bằng 0.</span>
                  </div>
                )}
              </article>

              <article className="card checkout-stage-card">
                <div className="checkout-card-intro">
                  <span className="section-kicker">Order Snapshot</span>
                  <h2>Xem lại sản phẩm, voucher và tạo đơn</h2>
                  <p>
                    Tổng tiền ở đây luôn phản ánh shipping mode đang chọn và preview voucher nếu bạn chưa tạo order.
                  </p>
                </div>

                <div className="order-list checkout-item-list">
                  {checkoutItems.map((item) => (
                    <div className="summary-row checkout-item-row" key={item.product_id}>
                      <span>
                        {item.name} x {item.quantity}
                      </span>
                      <strong>{formatCurrency(item.price * item.quantity)}</strong>
                    </div>
                  ))}
                </div>

                <div className="checkout-summary-stack">
                  <div className="summary-row">
                    <span>Tổng tạm tính</span>
                    <strong>{formatCurrency(pricingSummary?.subtotal_price ?? localSubtotal)}</strong>
                  </div>

                  {pricingSummary?.discount_amount ? (
                    <div className="summary-row coupon-summary-discount">
                      <span>Giảm giá {pricingSummary.coupon_code ? `(${pricingSummary.coupon_code})` : ""}</span>
                      <strong>-{formatCurrency(pricingSummary.discount_amount)}</strong>
                    </div>
                  ) : null}

                  <div className="summary-row">
                    <span>
                      Vận chuyển ({formatShippingMethodLabel(pricingSummary?.shipping_method ?? shippingMethod)})
                    </span>
                    <strong>{formatCurrency(pricingSummary?.shipping_fee ?? shippingFee)}</strong>
                  </div>

                  {couponPreview?.coupon_description && !latestOrder ? (
                    <div className="coupon-preview-card">
                      <strong>{couponPreview.coupon_code}</strong>
                      <span>{couponPreview.coupon_description}</span>
                    </div>
                  ) : null}

                  <div className="summary-row summary-total">
                    <span>Thành tiền</span>
                    <strong>{formatCurrency(computedTotal)}</strong>
                  </div>
                </div>

                {latestOrder ? (
                  <div className="payment-success checkout-inline-success">
                    <strong>Đơn hàng đã sẵn sàng để thanh toán</strong>
                    <span>Bạn có thể tiếp tục xử lý thanh toán ở panel bên phải.</span>
                  </div>
                ) : (
                  <div className="checkout-order-actions">
                    <label className="field" htmlFor="checkout-coupon-code">
                      <span className="field-label">Voucher</span>
                      <input
                        id="checkout-coupon-code"
                        placeholder="Nhập mã giảm giá"
                        value={couponCode}
                        onChange={(event) => {
                          setCouponCode(event.target.value);
                          setCouponPreview(null);
                        }}
                      />
                      <span className="field-hint">Xem trước tổng tiền sau giảm giá trước khi tạo đơn hàng.</span>
                    </label>

                    <div className="coupon-action-row">
                      <button
                        className="secondary-button"
                        disabled={isBusy === "preview"}
                        onClick={() => void handlePreviewCoupon()}
                        type="button"
                      >
                        {isBusy === "preview" ? "Đang kiểm tra..." : "Áp dụng voucher"}
                      </button>
                      <button
                        className="ghost-button"
                        disabled={!couponCode && !couponPreview}
                        onClick={handleClearCoupon}
                        type="button"
                      >
                        Gỡ voucher
                      </button>
                    </div>

                    <form className="checkout-order-form" onSubmit={handleCreateOrder}>
                      <button className="primary-button" disabled={isBusy === "order"} type="submit">
                        {isBusy === "order" ? "Đang tạo đơn..." : "Tạo đơn hàng"}
                      </button>
                    </form>
                  </div>
                )}
              </article>
            </div>

            <aside className="card checkout-payment-card">
              <div className="checkout-card-intro">
                <span className="section-kicker">Payment Console</span>
                <h2>Thanh toán và theo dõi trạng thái giao dịch</h2>
                <p>
                  {latestOrder
                    ? "Panel này dùng order snapshot hiện tại để gửi lệnh thanh toán sang payment flow."
                    : "Tạo order trước, sau đó payment form sẽ mở để xử lý gateway hoặc partial payment."}
                </p>
              </div>

              {latestOrder ? (
                <>
                  <div className="checkout-payment-summary">
                    <div className="summary-row">
                      <span>Mã đơn</span>
                      <strong>{latestOrder.id}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Tổng tiền</span>
                      <strong>{formatCurrency(latestOrder.total_price)}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Còn lại cần thanh toán</span>
                      <strong>{formatCurrency(outstandingPaymentAmount)}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Vận chuyển</span>
                      <strong>
                        {formatShippingMethodLabel(latestOrder.shipping_method)} •{" "}
                        {formatCurrency(latestOrder.shipping_fee)}
                      </strong>
                    </div>
                  </div>

                  {latestOrder.shipping_address ? (
                    <div className="coupon-preview-card checkout-address-preview">
                      <strong>{latestOrder.shipping_address.recipient_name}</strong>
                      <span>{latestOrder.shipping_address.phone}</span>
                      <span>{formatAddressLine(latestOrder.shipping_address)}</span>
                    </div>
                  ) : null}

                  {latestOrder.coupon_code ? (
                    <div className="summary-row">
                      <span>Voucher</span>
                      <strong>{latestOrder.coupon_code}</strong>
                    </div>
                  ) : null}

                  {latestOrder.discount_amount > 0 ? (
                    <div className="summary-row">
                      <span>Giảm giá</span>
                      <strong>-{formatCurrency(latestOrder.discount_amount)}</strong>
                    </div>
                  ) : null}

                  <form className="checkout-payment-form" onSubmit={handleProcessPayment}>
                    <label className="field" htmlFor="payment-method">
                      <span className="field-label">Phương thức thanh toán</span>
                      <select
                        id="payment-method"
                        value={paymentMethod}
                        onChange={(event) => setPaymentMethod(event.target.value)}
                      >
                        <option value="credit_card">Credit Card</option>
                        <option value="paypal">PayPal</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="momo">MoMo</option>
                      </select>
                    </label>

                    <label className="field" htmlFor="payment-amount">
                      <span className="field-label">Số tiền muốn thanh toán</span>
                      <input
                        id="payment-amount"
                        inputMode="decimal"
                        min="0"
                        placeholder={`Để trống để thanh toán hết ${formatCurrency(outstandingPaymentAmount)}`}
                        step="0.01"
                        type="number"
                        value={paymentAmount}
                        onChange={(event) => setPaymentAmount(event.target.value)}
                      />
                    </label>

                    <button
                      className="secondary-button"
                      disabled={isBusy === "payment" || outstandingPaymentAmount <= 0}
                      type="submit"
                    >
                      {isBusy === "payment" ? "Đang thanh toán..." : "Thanh toán"}
                    </button>
                  </form>
                </>
              ) : (
                <div className="checkout-payment-placeholder">
                  <p>Bạn cần tạo đơn hàng trước khi xử lý thanh toán.</p>
                  <span>Order id, shipping snapshot và số tiền cần trả sẽ xuất hiện ở đây sau bước create order.</span>
                </div>
              )}

              {latestPayment ? (
                <div className="payment-success checkout-payment-status">
                  <strong>Trạng thái thanh toán: {latestPayment.status}</strong>
                  <span>Mã giao dịch: {latestPayment.id}</span>
                  <span>Gateway: {latestPayment.gateway_provider}</span>
                  {typeof latestPayment.outstanding_amount === "number" ? (
                    <span>Còn lại: {formatCurrency(latestPayment.outstanding_amount)}</span>
                  ) : null}
                  {latestPayment.checkout_url ? (
                    <a className="text-link" href={latestPayment.checkout_url} rel="noreferrer" target="_blank">
                      Mở checkout URL
                    </a>
                  ) : null}
                </div>
              ) : null}
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}

function estimateShippingFee(subtotal: number, method: ShippingMethod) {
  if (method === "pickup") {
    return 0;
  }
  if (method === "express") {
    return 14.99;
  }
  if (subtotal >= 100) {
    return 0;
  }
  return 5.99;
}

function toShippingAddress(address: Address | null): ShippingAddress | undefined {
  if (!address) {
    return undefined;
  }

  return {
    recipient_name: address.recipient_name,
    phone: address.phone,
    street: address.street,
    ward: address.ward,
    district: address.district,
    city: address.city
  };
}

function formatAddressLine(address: ShippingAddress) {
  return [address.street, address.ward, address.district, address.city].filter(Boolean).join(", ");
}
