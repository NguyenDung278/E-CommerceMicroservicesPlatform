import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCart } from "@/features/cart/hooks/use-cart";
import { canSyncProductToWorkbook } from "@/features/home/workbook-sync-catalog";
import { syncWorkbookProductMutations } from "@/features/home/workbook-sync-client";
import { api, getErrorMessage } from "@/services/api";
import type { Address, OrderPreview, Product, ShippingAddress, ShippingOption } from "@/types/api";
import { formatCurrency, formatShippingMethodLabel } from "@/utils/format";
import { sanitizeText } from "@/utils/sanitize";
import "@/styles/pages/storefront/checkout-page.css";

type DirectProductState = {
  directProduct?: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  };
  appliedCouponCode?: string;
};

type PaymentChoice = "manual" | "momo";
type ShippingMethodChoice = "standard" | "express" | "pickup";

type CheckoutFormState = {
  fullName: string;
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
  phone: "",
};

const HARD_CODED_CHECKOUT_VOUCHER_CODE = "ND2026";
const HARD_CODED_CHECKOUT_VOUCHER_RATE = 0.25;

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, isAuthenticated } = useAuth();
  const { cart, clearCart } = useCart();
  const locationState = (location.state as DirectProductState | null) ?? null;
  const initialAppliedCouponCode = normalizeCheckoutCouponCode(
    locationState?.appliedCouponCode ?? "",
  );

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<CheckoutFormState>(emptyCheckoutForm);
  const [selectedShippingMethod, setSelectedShippingMethod] =
    useState<ShippingMethodChoice>("standard");
  const [paymentMethod, setPaymentMethod] = useState<PaymentChoice>("manual");
  const [feedback, setFeedback] = useState("");
  const [couponCode, setCouponCode] = useState(
    initialAppliedCouponCode || HARD_CODED_CHECKOUT_VOUCHER_CODE,
  );
  const [couponFeedback, setCouponFeedback] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState(
    initialAppliedCouponCode,
  );
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [pricingPreview, setPricingPreview] = useState<OrderPreview | null>(null);
  const [productLookup, setProductLookup] = useState<Record<string, Product>>({});

  const directProduct = locationState?.directProduct;
  const draftItems = useMemo(
    () =>
      directProduct
        ? [
            {
              product_id: directProduct.id,
              quantity: directProduct.quantity,
              name: directProduct.name,
              price: directProduct.price,
            },
          ]
        : cart.items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            name: item.name,
            price: item.price,
          })),
    [cart.items, directProduct]
  );
  const productLookupKey = draftItems
    .map((item) => item.product_id)
    .filter(Boolean)
    .sort()
    .join("|");
  const checkoutRequestFingerprint = useMemo(
    () =>
      buildCheckoutRequestFingerprint(
        draftItems,
        appliedCouponCode,
        selectedShippingMethod,
        form.fullName,
        form.phone
      ),
    [appliedCouponCode, draftItems, form.fullName, form.phone, selectedShippingMethod]
  );
  const [orderRequestKey, setOrderRequestKey] = useState(() =>
    generateCheckoutIdempotencyKey("order")
  );
  const [paymentRequestKey, setPaymentRequestKey] = useState(() =>
    generateCheckoutIdempotencyKey("payment")
  );
  const [createdOrderId, setCreatedOrderId] = useState("");

  useEffect(() => {
    setOrderRequestKey(generateCheckoutIdempotencyKey("order"));
    setPaymentRequestKey(generateCheckoutIdempotencyKey("payment"));
    setCreatedOrderId("");
  }, [checkoutRequestFingerprint]);

  useEffect(() => {
    setPaymentRequestKey(generateCheckoutIdempotencyKey("payment"));
  }, [paymentMethod]);

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
      phone: defaultAddress.phone,
    }));
  }, [addresses, form]);

  useEffect(() => {
    let active = true;

    const uniqueProductIds = Array.from(
      new Set(draftItems.map((item) => item.product_id).filter(Boolean))
    );
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
  }, [draftItems, productLookupKey]);

  const checkoutItems: CheckoutDisplayItem[] = draftItems.map((item) => {
    const product = productLookup[item.product_id];
    return {
      ...item,
      imageUrl: product?.image_url || product?.image_urls[0],
      subtitle: buildCheckoutItemSubtitle(product),
    };
  });

  const subtotal = checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const fallbackShippingOptions = buildFallbackShippingOptions(subtotal);
  const selectedFallbackShippingOption =
    fallbackShippingOptions.find((option) => option.method === selectedShippingMethod) ??
    fallbackShippingOptions[0];
  const shippingOptions =
    pricingPreview?.supported_shipping_methods.length
      ? pricingPreview.supported_shipping_methods
      : fallbackShippingOptions;
  const selectedShippingOption =
    shippingOptions.find((option) => option.method === selectedShippingMethod) ??
    selectedFallbackShippingOption;
  const shippingFee = selectedFallbackShippingOption?.fee ?? 0;
  const grossTotal = subtotal + shippingFee;
  const hardcodedVoucherApplied = normalizeCheckoutCouponCode(appliedCouponCode) === HARD_CODED_CHECKOUT_VOUCHER_CODE;
  const voucherDiscount =
    hardcodedVoucherApplied && grossTotal > 0
      ? roundCurrencyAmount(grossTotal * HARD_CODED_CHECKOUT_VOUCHER_RATE)
      : 0;
  const total = Math.max(grossTotal - voucherDiscount, 0);
  const displayedSubtotal = pricingPreview?.subtotal_price ?? subtotal;
  const displayedShippingFee = pricingPreview?.shipping_fee ?? (selectedShippingOption?.fee ?? shippingFee);
  const displayedDiscount = pricingPreview?.discount_amount ?? voucherDiscount;
  const displayedTotal = pricingPreview?.total_price ?? total;
  const displayedCouponCode = pricingPreview?.coupon_code ?? appliedCouponCode;
  const displayedEtaLabel = pricingPreview?.eta_label ?? selectedShippingOption?.eta_label ?? "";
  const displayedDeliveryPromise =
    pricingPreview?.delivery_promise ??
    selectedShippingOption?.delivery_promise ??
    "Tracked delivery and clear post-purchase updates.";
  const savedAddressLabel =
    selectedShippingMethod === "pickup"
      ? "Pickup only requires your contact details."
      : addresses.length > 0
      ? "Pre-filled from your saved contact book."
      : "Fill in the delivery contact details for this order.";

  useEffect(() => {
    let active = true;

    if (!token || draftItems.length === 0) {
      setPricingPreview(null);
      return () => {
        active = false;
      };
    }

    const shippingAddress = buildCheckoutPreviewAddress(form, selectedShippingMethod);
    if (selectedShippingMethod !== "pickup" && !shippingAddress) {
      setPricingPreview(null);
      return () => {
        active = false;
      };
    }

    void api
      .previewOrder(token, {
        items: draftItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        coupon_code: appliedCouponCode || undefined,
        shipping_method: selectedShippingMethod,
        shipping_address: shippingAddress,
      })
      .then((response) => {
        if (active) {
          setPricingPreview(response.data);
        }
      })
      .catch(() => {
        if (active) {
          setPricingPreview(null);
        }
      });

    return () => {
      active = false;
    };
  }, [appliedCouponCode, draftItems, form, selectedShippingMethod, token]);

  function updateForm<Key extends keyof CheckoutFormState>(
    field: Key,
    value: CheckoutFormState[Key]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setFeedback("");
  }

  async function handleApplyVoucher() {
    const normalizedCouponCode = normalizeCheckoutCouponCode(
      couponCode || HARD_CODED_CHECKOUT_VOUCHER_CODE
    );

    if (!normalizedCouponCode) {
      setAppliedCouponCode("");
      setPricingPreview(null);
      setCouponFeedback("Vui lòng nhập mã voucher trước khi áp dụng.");
      return;
    }

    if (draftItems.length === 0) {
      setCouponFeedback("Không có sản phẩm nào để áp dụng voucher.");
      return;
    }

    if (normalizedCouponCode !== HARD_CODED_CHECKOUT_VOUCHER_CODE) {
      setAppliedCouponCode("");
      setPricingPreview(null);
      setCouponFeedback(`Checkout hiện chỉ hỗ trợ voucher ${HARD_CODED_CHECKOUT_VOUCHER_CODE}.`);
      return;
    }

    setCouponCode(normalizedCouponCode);
    setAppliedCouponCode(normalizedCouponCode);
    setPricingPreview(buildLocalVoucherPreview(subtotal, selectedShippingMethod, normalizedCouponCode));
    setCouponFeedback(
      `Voucher ${normalizedCouponCode} đã được áp dụng. Giá trị đơn hàng đang được cập nhật.`
    );

    const shippingAddress = buildCheckoutPreviewAddress(form, selectedShippingMethod);
    if (!token || (selectedShippingMethod !== "pickup" && !shippingAddress)) {
      return;
    }

    try {
      setIsApplyingVoucher(true);
      const response = await api.previewOrder(token, {
        items: draftItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        coupon_code: normalizedCouponCode,
        shipping_method: selectedShippingMethod,
        shipping_address: shippingAddress,
      });
      setPricingPreview(response.data);
      setCouponFeedback(`Voucher ${response.data.coupon_code ?? normalizedCouponCode} đã được áp dụng.`);
    } catch (reason) {
      setCouponFeedback(getErrorMessage(reason));
    } finally {
      setIsApplyingVoucher(false);
    }
  }

  function handleClearVoucher() {
    setCouponCode(HARD_CODED_CHECKOUT_VOUCHER_CODE);
    setAppliedCouponCode("");
    setPricingPreview(null);
    setCouponFeedback("");
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
    const normalizedPhone = sanitizeText(form.phone);

    if (!normalizedFullName || !normalizedPhone) {
      setFeedback(
        selectedShippingMethod === "pickup"
          ? "Vui lòng điền đủ họ tên và số điện thoại để xác nhận lượt nhận tại quầy."
          : "Vui lòng điền đủ họ tên và số điện thoại để xác nhận giao hàng."
      );
      return;
    }

    let orderId = createdOrderId;
    try {
      setIsSubmitting(true);

      if (!orderId) {
        const orderResponse = await api.createOrder(
          token,
          {
            items: draftItems.map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
            })),
            coupon_code: appliedCouponCode || undefined,
            shipping_method: selectedShippingMethod,
            shipping_address: buildCheckoutSubmissionAddress(form, selectedShippingMethod),
          },
          {
            idempotencyKey: orderRequestKey,
          }
        );
        orderId = orderResponse.data.id;
        setCreatedOrderId(orderId);
      }

      const paymentResponse = await api.processPayment(
        token,
        {
          order_id: orderId,
          payment_method: paymentMethod,
        },
        {
          idempotencyKey: paymentRequestKey,
        }
      );

      await syncPurchasedProductsToWorkbook(draftItems);

      if (!directProduct && cart.items.length > 0) {
        await clearCart();
      }

      navigate(`/orders/${orderId}`, {
        replace: true,
        state: {
          confirmation: true,
          paymentId: paymentResponse.data.id,
        },
      });
    } catch (reason) {
      const message = getErrorMessage(reason);
      if (createdOrderId) {
        setFeedback(
          `Order đã được tạo nhưng thanh toán chưa hoàn tất. Bạn có thể retry payment an toàn hoặc mở trang order để tiếp tục. ${message}`
        );
      } else if (orderId) {
        setCreatedOrderId(orderId);
        setFeedback(
          `Order đã được tạo nhưng thanh toán chưa hoàn tất. Bạn có thể retry payment an toàn hoặc mở trang order để tiếp tục. ${message}`
        );
      } else {
        setFeedback(message);
      }
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
        {createdOrderId ? (
          <div className="hero-actions">
            <Link className="secondary-link" to={`/orders/${createdOrderId}`}>
              Open Current Order
            </Link>
          </div>
        ) : null}

        {draftItems.length === 0 ? (
          <div className="empty-card checkout-empty-state">
            <span className="section-kicker">Bag Empty</span>
            <h2>Không có sản phẩm nào để thanh toán</h2>
            <p>
              Hãy thêm sản phẩm vào giỏ hoặc dùng nút mua ngay từ trang chi tiết để bắt đầu
              checkout.
            </p>
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
                  <h2>Delivery Contact</h2>
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
                  <h2>Shipping Method</h2>
                </div>

                <div className="checkout-payment-choice-list">
                  {shippingOptions.map((option) => (
                    <label
                      className={
                        selectedShippingMethod === option.method
                          ? "checkout-payment-choice checkout-payment-choice-active"
                          : "checkout-payment-choice"
                      }
                      key={option.method}
                    >
                      <div className="checkout-payment-choice-copy">
                        <input
                          checked={selectedShippingMethod === option.method}
                          name="shipping-method"
                          type="radio"
                          value={option.method}
                          onChange={() =>
                            setSelectedShippingMethod(option.method as ShippingMethodChoice)
                          }
                        />
                        <div>
                          <strong>{option.label}</strong>
                          <span>
                            {option.description}
                            {option.description ? " " : ""}
                            {option.fee === 0 ? "Free" : formatCurrency(option.fee)} •{" "}
                            {option.eta_label}
                          </span>
                        </div>
                      </div>
                      <span className="checkout-method-pill">{formatShippingMethodLabel(option.method)}</span>
                    </label>
                  ))}
                </div>

                <p className="checkout-section-note">
                  {displayedDeliveryPromise}
                  {displayedEtaLabel ? ` ETA: ${displayedEtaLabel}.` : ""}
                </p>
              </section>

              <section className="checkout-editorial-section">
                <div className="checkout-section-title">
                  <span className="checkout-step-badge">3</span>
                  <h2>Payment Method</h2>
                </div>

                <div className="checkout-payment-choice-list">
                  <label
                    className={
                      paymentMethod === "manual"
                        ? "checkout-payment-choice checkout-payment-choice-active"
                        : "checkout-payment-choice"
                    }
                  >
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

                  <label
                    className={
                      paymentMethod === "momo"
                        ? "checkout-payment-choice checkout-payment-choice-active"
                        : "checkout-payment-choice"
                    }
                  >
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
                        <span>
                          Creates a pending payment and returns an external checkout link.
                        </span>
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
                        {item.imageUrl ? (
                          <img alt={item.name} src={item.imageUrl} />
                        ) : (
                          <span>{item.name.slice(0, 1)}</span>
                        )}
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

                <div className="checkout-voucher-panel">
                  <label className="checkout-voucher-label" htmlFor="checkout-voucher-code">
                    Voucher
                  </label>
                  <div className="checkout-voucher-row">
                    <input
                      id="checkout-voucher-code"
                      value={couponCode}
                      placeholder="Nhập mã voucher"
                      onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    />
                    <button
                      className="secondary-button checkout-voucher-action"
                      type="button"
                      onClick={handleApplyVoucher}
                    >
                      {isApplyingVoucher ? "Đang áp dụng..." : "Áp dụng voucher"}
                    </button>
                  </div>
                  {appliedCouponCode ? (
                    <button
                      className="checkout-voucher-clear"
                      type="button"
                      onClick={handleClearVoucher}
                    >
                      Gỡ voucher
                    </button>
                  ) : null}
                  {couponFeedback ? (
                    <p className="checkout-voucher-feedback">{couponFeedback}</p>
                  ) : null}
                </div>

                <div className="checkout-summary-totals">
                  <div className="checkout-summary-line">
                    <span>Method</span>
                    <span>{formatShippingMethodLabel(selectedShippingMethod)}</span>
                  </div>
                  {displayedEtaLabel ? (
                    <div className="checkout-summary-line">
                      <span>ETA</span>
                      <span>{displayedEtaLabel}</span>
                    </div>
                  ) : null}
                  <div className="checkout-summary-line">
                    <span>Subtotal</span>
                    <span>{formatCurrency(displayedSubtotal)}</span>
                  </div>
                  <div className="checkout-summary-line">
                    <span>Shipping</span>
                    <span
                      className={
                        displayedShippingFee === 0 ? "checkout-shipping-free" : undefined
                      }
                    >
                      {displayedShippingFee === 0 ? "Free" : formatCurrency(displayedShippingFee)}
                    </span>
                  </div>
                  {displayedDiscount > 0 && displayedCouponCode ? (
                    <div className="checkout-summary-line">
                      <span>Voucher ({displayedCouponCode})</span>
                      <span>-{formatCurrency(displayedDiscount)}</span>
                    </div>
                  ) : null}
                  <div className="checkout-summary-line checkout-summary-line-total">
                    <span>Total</span>
                    <strong>{formatCurrency(displayedTotal)}</strong>
                  </div>
                </div>

                <button
                  className="primary-button checkout-place-order"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting
                    ? "Processing Checkout..."
                    : createdOrderId
                    ? "Retry Payment"
                    : "Place Order"}
                </button>

                <p className="checkout-summary-caption">
                  {displayedCouponCode
                    ? `Voucher ${displayedCouponCode} đang được áp dụng cho đơn hàng này. `
                    : ""}
                  {displayedDeliveryPromise ? `${displayedDeliveryPromise} ` : ""}
                  By placing your order, you agree to our Terms of Service.
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

async function syncPurchasedProductsToWorkbook(items: Array<{ product_id: string }>) {
  const productIds = Array.from(
    new Set(items.map((item) => item.product_id.trim()).filter(Boolean))
  );
  if (productIds.length === 0) {
    return;
  }

  try {
    const latestProducts = await Promise.all(
      productIds.map((productId) => api.getProductById(productId).then((response) => response.data))
    );
    const syncableProducts = latestProducts.filter(canSyncProductToWorkbook);
    if (syncableProducts.length === 0) {
      return;
    }
    await syncWorkbookProductMutations(
      syncableProducts.map((product) => ({
        operation: "upsert",
        product,
      }))
    );
  } catch (reason) {
    console.warn("Failed to sync sold products into workbook CSV/XLSX.", reason);
  }
}

function hasCheckoutFormValue(form: CheckoutFormState) {
  return Boolean(form.fullName || form.phone);
}

function buildCheckoutItemSubtitle(product?: Product) {
  if (!product) {
    return "Editorial selection";
  }

  const subtitle = [product.category, product.brand].filter(Boolean).join(" / ");
  return subtitle || "Curated piece";
}

function buildCheckoutPreviewAddress(
  form: CheckoutFormState,
  shippingMethod: ShippingMethodChoice
): ShippingAddress | undefined {
  const recipientName = sanitizeText(form.fullName);
  const phone = sanitizeText(form.phone);

  if (shippingMethod === "pickup" || !recipientName || !phone) {
    return undefined;
  }

  return {
    recipient_name: recipientName,
    phone,
  };
}

function buildCheckoutSubmissionAddress(
  form: CheckoutFormState,
  shippingMethod: ShippingMethodChoice
): ShippingAddress | undefined {
  const recipientName = sanitizeText(form.fullName);
  const phone = sanitizeText(form.phone);

  if (!recipientName || !phone) {
    return undefined;
  }

  if (shippingMethod === "pickup") {
    return undefined;
  }

  return {
    recipient_name: recipientName,
    phone,
  };
}

function normalizeCheckoutCouponCode(value: string) {
  return sanitizeText(value).toUpperCase();
}

function buildLocalVoucherPreview(
  subtotal: number,
  shippingMethod: ShippingMethodChoice,
  couponCode: string
): OrderPreview {
  const shippingOptions = buildFallbackShippingOptions(subtotal);
  const selectedShippingOption =
    shippingOptions.find((option) => option.method === shippingMethod) ?? shippingOptions[0];
  const shippingFee = selectedShippingOption?.fee ?? 0;
  const normalizedCouponCode = normalizeCheckoutCouponCode(couponCode);
  const grossTotal = roundCurrencyAmount(subtotal + shippingFee);
  const discountAmount =
    normalizedCouponCode === HARD_CODED_CHECKOUT_VOUCHER_CODE
      ? roundCurrencyAmount(grossTotal * HARD_CODED_CHECKOUT_VOUCHER_RATE)
      : 0;

  return {
    subtotal_price: subtotal,
    discount_amount: discountAmount,
    coupon_code: normalizedCouponCode || undefined,
    coupon_description:
      normalizedCouponCode === HARD_CODED_CHECKOUT_VOUCHER_CODE
        ? "Giảm 25% cho toàn bộ giá trị đơn hàng."
        : undefined,
    shipping_method: shippingMethod,
    shipping_fee: shippingFee,
    eta_label: selectedShippingOption?.eta_label,
    delivery_promise: selectedShippingOption?.delivery_promise,
    supported_shipping_methods: shippingOptions,
    total_price: Math.max(roundCurrencyAmount(grossTotal - discountAmount), 0),
  };
}

function buildFallbackShippingOptions(subtotal: number): ShippingOption[] {
  return [
    {
      method: "standard",
      label: "Standard delivery",
      description: "Best value for everyday orders.",
      fee: subtotal >= 100 || subtotal === 0 ? 0 : 5.99,
      eta_min_days: 3,
      eta_max_days: 5,
      eta_label: "3-5 business days",
      delivery_promise: "Tracked delivery with complimentary shipping from $100.",
    },
    {
      method: "express",
      label: "Express delivery",
      description: "Priority handling for time-sensitive orders.",
      fee: 14.99,
      eta_min_days: 1,
      eta_max_days: 2,
      eta_label: "1-2 business days",
      delivery_promise: "Priority pick, pack, and dispatch on the next fulfillment window.",
    },
    {
      method: "pickup",
      label: "Store pickup",
      description: "Collect from the atelier desk when it suits you.",
      fee: 0,
      eta_min_days: 0,
      eta_max_days: 1,
      eta_label: "Ready for pickup within 2 hours",
      delivery_promise: "We will hold the order and confirm pickup readiness by message.",
    },
  ];
}

function roundCurrencyAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function buildCheckoutRequestFingerprint(
  items: Array<{ product_id: string; quantity: number }>,
  couponCode: string,
  shippingMethod: ShippingMethodChoice,
  fullName: string,
  phone: string
) {
  const normalizedItems = items
    .map((item) => `${item.product_id.trim()}:${item.quantity}`)
    .sort()
    .join("|");

  return JSON.stringify({
    items: normalizedItems,
    couponCode: normalizeCheckoutCouponCode(couponCode),
    shippingMethod,
    fullName: sanitizeText(fullName),
    phone: sanitizeText(phone),
  });
}

function generateCheckoutIdempotencyKey(scope: "order" | "payment") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `checkout:${scope}:${crypto.randomUUID()}`;
  }

  return `checkout:${scope}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}
