import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { api, getErrorMessage } from "../lib/api";
import type { Address, Product } from "../types/api";
import { formatCurrency } from "../utils/format";
import { sanitizeText } from "../utils/sanitize";
import "./CheckoutPage.css";

type DirectProductState = {
  directProduct?: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  };
};

type PaymentChoice = "manual" | "momo";

type CheckoutFormState = {
  fullName: string;
  street: string;
  city: string;
  postcode: string;
  phone: string;
};

type CheckoutDisplayItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  subtitle: string;
};

const emptyCheckoutForm: CheckoutFormState = {
  fullName: "",
  street: "",
  city: "",
  postcode: "",
  phone: ""
};

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, isAuthenticated } = useAuth();
  const { cart, clearCart } = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<CheckoutFormState>(emptyCheckoutForm);
  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice>("manual");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [productLookup, setProductLookup] = useState<Record<string, Product>>({});

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
  const productLookupKey = draftItems
    .map((item) => item.product_id)
    .filter(Boolean)
    .sort()
    .join("|");

  useEffect(() => {
    let active = true;

    if (!token) {
      setAddresses([]);
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

  useEffect(() => {
    const defaultAddress = addresses.find((item) => item.is_default) ?? addresses[0];
    if (!defaultAddress || hasCheckoutFormValue(form)) {
      return;
    }

    setForm((current) => ({
      ...current,
      fullName: defaultAddress.recipient_name,
      street: defaultAddress.street,
      city: defaultAddress.city,
      postcode: defaultAddress.ward || defaultAddress.district,
      phone: defaultAddress.phone
    }));
  }, [addresses, form]);

  useEffect(() => {
    let active = true;

    const uniqueProductIds = Array.from(new Set(draftItems.map((item) => item.product_id).filter(Boolean)));
    if (uniqueProductIds.length === 0) {
      setProductLookup({});
      return () => {
        active = false;
      };
    }

    void Promise.all(
      uniqueProductIds.map((productId) =>
        api
          .getProductById(productId)
          .then((response) => [productId, response.data] as const)
          .catch(() => [productId, null] as const)
      )
    ).then((entries) => {
      if (!active) {
        return;
      }

      const nextLookup: Record<string, Product> = {};
      entries.forEach(([productId, product]) => {
        if (product) {
          nextLookup[productId] = product;
        }
      });
      setProductLookup(nextLookup);
    });

    return () => {
      active = false;
    };
  }, [productLookupKey]);

  const checkoutItems: CheckoutDisplayItem[] = draftItems.map((item) => {
    const product = productLookup[item.product_id];
    return {
      ...item,
      imageUrl: product?.image_url || product?.image_urls[0],
      subtitle: buildCheckoutItemSubtitle(product)
    };
  });

  const subtotal = checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = subtotal >= 100 || subtotal === 0 ? 0 : 5.99;
  const total = subtotal + shippingFee;
  const savedAddressLabel = addresses.length > 0 ? "Pre-filled from your saved address book." : "Fill in the shipping details for this order.";

  function updateForm<Key extends keyof CheckoutFormState>(field: Key, value: CheckoutFormState[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFeedback("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAuthenticated || !token) {
      navigate("/login", { state: { from: location } });
      return;
    }

    if (draftItems.length === 0) {
      setFeedback("Không có sản phẩm nào để checkout.");
      return;
    }

    const normalizedFullName = sanitizeText(form.fullName);
    const normalizedStreet = sanitizeText(form.street);
    const normalizedCity = sanitizeText(form.city);
    const normalizedPostcode = sanitizeText(form.postcode);
    const normalizedPhone = sanitizeText(form.phone);

    if (!normalizedFullName || !normalizedStreet || !normalizedCity || !normalizedPhone) {
      setFeedback("Vui lòng điền đủ họ tên, địa chỉ giao hàng, thành phố và số điện thoại.");
      return;
    }

    try {
      setIsSubmitting(true);

      const orderResponse = await api.createOrder(token, {
        items: draftItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity
        })),
        shipping_method: "standard",
        shipping_address: {
          recipient_name: normalizedFullName,
          phone: normalizedPhone,
          street: normalizedStreet,
          ward: normalizedPostcode || undefined,
          district: normalizedPostcode || normalizedCity,
          city: normalizedCity
        }
      });

      const paymentResponse = await api.processPayment(token, {
        order_id: orderResponse.data.id,
        payment_method: paymentMethod
      });

      if (!directProduct && cart.items.length > 0) {
        await clearCart();
      }

      navigate(`/orders/${orderResponse.data.id}`, {
        replace: true,
        state: {
          confirmation: true,
          paymentId: paymentResponse.data.id
        }
      });
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-stack checkout-page">
      <section className="content-section checkout-shell">
        <div className="checkout-shell-heading">
          <h1>Checkout</h1>
          <p>Complete your order details below.</p>
        </div>

        {feedback ? <div className="feedback feedback-info">{feedback}</div> : null}

        {draftItems.length === 0 ? (
          <div className="empty-card checkout-empty-state">
            <span className="section-kicker">Bag Empty</span>
            <h2>Không có sản phẩm nào để thanh toán</h2>
            <p>Hãy thêm sản phẩm vào giỏ hoặc dùng nút mua ngay từ trang chi tiết để bắt đầu checkout.</p>
            <div className="hero-actions">
              <Link className="primary-link" to="/products">
                Browse Products
              </Link>
              <Link className="secondary-link" to="/cart">
                View Bag
              </Link>
            </div>
          </div>
        ) : (
          <form className="checkout-editorial-grid" onSubmit={handleSubmit}>
            <div className="checkout-editorial-main">
              <section className="checkout-editorial-section">
                <div className="checkout-section-title">
                  <span className="checkout-step-badge">1</span>
                  <h2>Shipping Address</h2>
                </div>

                <p className="checkout-section-note">
                  {isLoadingAddresses ? "Loading your saved address..." : savedAddressLabel}
                </p>

                <div className="checkout-field-grid">
                  <label className="checkout-field checkout-field-full">
                    <span>Full Name</span>
                    <input
                      placeholder="Julian Thorne"
                      value={form.fullName}
                      onChange={(event) => updateForm("fullName", event.target.value)}
                    />
                  </label>

                  <label className="checkout-field checkout-field-full">
                    <span>Street Address</span>
                    <input
                      placeholder="1242 Forest Avenue, Suite 400"
                      value={form.street}
                      onChange={(event) => updateForm("street", event.target.value)}
                    />
                  </label>

                  <label className="checkout-field">
                    <span>City</span>
                    <input
                      placeholder="Portland"
                      value={form.city}
                      onChange={(event) => updateForm("city", event.target.value)}
                    />
                  </label>

                  <label className="checkout-field">
                    <span>Postcode</span>
                    <input
                      placeholder="97205"
                      value={form.postcode}
                      onChange={(event) => updateForm("postcode", event.target.value)}
                    />
                  </label>

                  <label className="checkout-field checkout-field-full">
                    <span>Phone</span>
                    <input
                      placeholder="+1 (503) 555-0123"
                      type="tel"
                      value={form.phone}
                      onChange={(event) => updateForm("phone", event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="checkout-editorial-section">
                <div className="checkout-section-title">
                  <span className="checkout-step-badge">2</span>
                  <h2>Payment Method</h2>
                </div>

                <div className="checkout-payment-choice-list">
                  <label className={paymentMethod === "manual" ? "checkout-payment-choice checkout-payment-choice-active" : "checkout-payment-choice"}>
                    <div className="checkout-payment-choice-copy">
                      <input
                        checked={paymentMethod === "manual"}
                        name="payment-method"
                        type="radio"
                        value="manual"
                        onChange={() => setPaymentMethod("manual")}
                      />
                      <div>
                        <strong>Instant Demo Payment</strong>
                        <span>Marks the order as paid immediately for local testing.</span>
                      </div>
                    </div>
                    <span className="checkout-payment-icon" aria-hidden="true">
                      <span className="checkout-credit-card-icon" />
                    </span>
                  </label>

                  <label className={paymentMethod === "momo" ? "checkout-payment-choice checkout-payment-choice-active" : "checkout-payment-choice"}>
                    <div className="checkout-payment-choice-copy">
                      <input
                        checked={paymentMethod === "momo"}
                        name="payment-method"
                        type="radio"
                        value="momo"
                        onChange={() => setPaymentMethod("momo")}
                      />
                      <div>
                        <strong>MoMo Hosted Checkout</strong>
                        <span>Creates a pending payment and returns an external checkout link.</span>
                      </div>
                    </div>
                    <span className="checkout-payment-icon" aria-hidden="true">
                      <span className="checkout-wallet-icon" />
                    </span>
                  </label>
                </div>

                <p className="checkout-section-note">
                  {paymentMethod === "momo"
                    ? "After the order is created, you will get a hosted payment link on the confirmation screen."
                    : "Use this mode for local demos when you want the order to become paid immediately."}
                </p>
              </section>
            </div>

            <aside className="checkout-summary-panel">
              <div className="checkout-summary-card">
                <h3>Order Summary</h3>

                <div className="checkout-summary-items">
                  {checkoutItems.map((item) => (
                    <article className="checkout-summary-item" key={item.product_id}>
                      <div className="checkout-summary-thumb">
                        {item.imageUrl ? <img alt={item.name} src={item.imageUrl} /> : <span>{item.name.slice(0, 1)}</span>}
                      </div>
                      <div className="checkout-summary-copy">
                        <h4>{item.name}</h4>
                        <p>{item.subtitle}</p>
                        <div className="checkout-summary-meta">
                          <span>Qty: {item.quantity}</span>
                          <strong>{formatCurrency(item.price * item.quantity)}</strong>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="checkout-summary-totals">
                  <div className="checkout-summary-line">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="checkout-summary-line">
                    <span>Shipping</span>
                    <span className={shippingFee === 0 ? "checkout-shipping-free" : undefined}>
                      {shippingFee === 0 ? "Free" : formatCurrency(shippingFee)}
                    </span>
                  </div>
                  <div className="checkout-summary-line checkout-summary-line-total">
                    <span>Total</span>
                    <strong>{formatCurrency(total)}</strong>
                  </div>
                </div>

                <button className="primary-button checkout-place-order" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Placing Order..." : "Place Order"}
                </button>

                <p className="checkout-summary-caption">
                  Secure SSL encrypted checkout. By placing your order, you agree to our Terms of Service.
                </p>
              </div>

              <div className="checkout-summary-trust">
                <span>Secure Checkout</span>
                <span>Tracked Delivery</span>
                <span>Crafted Goods</span>
              </div>
            </aside>
          </form>
        )}
      </section>
    </div>
  );
}

function hasCheckoutFormValue(form: CheckoutFormState) {
  return Boolean(form.fullName || form.street || form.city || form.postcode || form.phone);
}

function buildCheckoutItemSubtitle(product?: Product) {
  if (!product) {
    return "Editorial selection";
  }

  const subtitle = [product.category, product.brand].filter(Boolean).join(" / ");
  return subtitle || "Curated piece";
}
