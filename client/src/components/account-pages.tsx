"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { AccountShell } from "@/components/account-shell";
import {
  EmptyState,
  Field,
  InlineAlert,
  LoadingScreen,
  StatusPill,
  SurfaceCard,
  TextInput,
} from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { useOrderPayments } from "@/hooks/useOrderPayments";
import { useSavedAddresses } from "@/hooks/useSavedAddresses";
import { orderApi, paymentApi, productApi, userApi } from "@/lib/api";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { cn, fallbackImageForProduct } from "@/lib/utils";
import type { Address, Order, OrderEvent, Payment, Product } from "@/types/api";
import {
  formatCurrency,
  formatDateTime,
  formatLongDate,
  formatShippingMethodLabel,
  formatShortDate,
  formatShortOrderId,
  formatStatusLabel,
  getDisplayName,
  humanizeToken,
} from "@/utils/format";

export function ProfileDashboard() {
  const { token, user, updateProfile, resendVerificationEmail } = useAuth();
  const { orders, paymentsByOrder, isLoading } = useOrderPayments(token);
  const { addresses } = useSavedAddresses(token);
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFirstName(user?.first_name || "");
    setLastName(user?.last_name || "");
  }, [user?.first_name, user?.last_name]);

  const recentOrders = orders.slice(0, 3);
  const paymentCount = Object.values(paymentsByOrder).flat().length;
  const defaultAddress = addresses.find((address) => address.is_default) ?? addresses[0] ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setBusy(true);
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      setFeedback("Thông tin hồ sơ đã được cập nhật.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendVerification() {
    try {
      setBusy(true);
      await resendVerificationEmail();
      setFeedback("Email xác minh mới đã được gửi.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell title="Hồ sơ tài khoản" description="Tổng hợp thông tin cá nhân, trạng thái xác minh, đơn hàng gần đây và địa chỉ mặc định trong cùng một màn hình.">
      {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

      <div className="grid gap-5 md:grid-cols-3">
        <SurfaceCard className="p-6">
          <p className="eyebrow">Orders</p>
          <p className="mt-4 font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">{orders.length}</p>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">Tổng số đơn hàng đang đồng bộ từ order-service.</p>
        </SurfaceCard>
        <SurfaceCard className="p-6">
          <p className="eyebrow">Payments</p>
          <p className="mt-4 font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">{paymentCount}</p>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">Giao dịch lấy từ payment-service và map theo order hiện tại.</p>
        </SurfaceCard>
        <SurfaceCard className="p-6">
          <p className="eyebrow">Addresses</p>
          <p className="mt-4 font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">{addresses.length}</p>
          <p className="mt-3 text-sm leading-7 text-on-surface-variant">Địa chỉ mặc định: {defaultAddress ? defaultAddress.city : "Chưa có"}.</p>
        </SurfaceCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SurfaceCard className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Profile</p>
              <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                {getDisplayName(user?.first_name, user?.last_name)}
              </h2>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">{user?.email}</p>
            </div>
            <StatusPill status={user?.email_verified ? "verified" : "pending"} />
          </div>

          <form className="mt-6 grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
            <Field htmlFor="profile-first-name" label="First name" required>
              <TextInput id="profile-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </Field>
            <Field htmlFor="profile-last-name" label="Last name" required>
              <TextInput id="profile-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </Field>
            <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row">
              <button type="submit" className={cn(buttonStyles({ size: "lg" }), "w-full sm:w-auto")} disabled={busy}>
                {busy ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
              {!user?.email_verified ? (
                <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full sm:w-auto")} disabled={busy} onClick={() => void handleResendVerification()}>
                  Gửi lại email xác minh
                </button>
              ) : null}
            </div>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="eyebrow">Default address</p>
          {defaultAddress ? (
            <div className="mt-4 space-y-3 text-sm leading-7 text-on-surface-variant">
              <p className="font-semibold text-primary">{defaultAddress.recipient_name}</p>
              <p>{defaultAddress.street}</p>
              <p>{[defaultAddress.ward, defaultAddress.district, defaultAddress.city].filter(Boolean).join(", ")}</p>
              <p>{defaultAddress.phone}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-on-surface-variant">Chưa có địa chỉ lưu sẵn. Bạn có thể thêm mới tại màn Địa chỉ.</p>
          )}
          <Link href="/addresses" className={cn(buttonStyles({ variant: "secondary" }), "mt-6 w-full")}>
            Quản lý địa chỉ
          </Link>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Recent orders</p>
            <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">Đơn hàng gần đây</h2>
          </div>
          <Link href="/myorders" className={buttonStyles({ variant: "tertiary" })}>
            Xem toàn bộ
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-6"><LoadingScreen label="Đang tải lịch sử đơn hàng..." /></div>
        ) : recentOrders.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="Chưa có đơn hàng" description="Sau khi hoàn tất checkout, các đơn gần đây sẽ xuất hiện tại đây." />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {recentOrders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="block rounded-[1.5rem] bg-surface p-5 transition hover:bg-surface-container-high">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-primary">{formatShortOrderId(order.id)}</p>
                    <p className="mt-2 text-sm text-on-surface-variant">{formatShortDate(order.created_at)} · {formatShippingMethodLabel(order.shipping_method)}</p>
                  </div>
                  <div className="text-right">
                    <StatusPill status={order.status} />
                    <p className="mt-2 font-semibold text-primary">{formatCurrency(order.total_price)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SurfaceCard>
    </AccountShell>
  );
}

export function OrdersPageView() {
  const { token } = useAuth();
  const { orders, isLoading, error } = useOrderPayments(token);

  return (
    <AccountShell title="Lịch sử đơn hàng" description="Xem lại toàn bộ đơn đã đặt, trạng thái hiện tại và tổng tiền thanh toán.">
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      {isLoading ? (
        <LoadingScreen label="Đang tải lịch sử đơn hàng..." />
      ) : orders.length === 0 ? (
        <EmptyState title="Bạn chưa có đơn hàng nào" description="Hoàn tất checkout để order-service bắt đầu ghi nhận lịch sử mua sắm." />
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`} className="rounded-[2rem] bg-surface-container-low p-6 transition hover:-translate-y-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Order</p>
                  <h2 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                    {formatShortOrderId(order.id)}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                    {formatShortDate(order.created_at)} · {formatShippingMethodLabel(order.shipping_method)} · {order.items.length} mặt hàng
                  </p>
                </div>
                <div className="text-right">
                  <StatusPill status={order.status} />
                  <p className="mt-3 font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                    {formatCurrency(order.total_price)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AccountShell>
  );
}

export function OrderDetailPageView({ orderId }: { orderId: string }) {
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [productLookup, setProductLookup] = useState<Record<string, Product>>({});
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isConfirmation = searchParams.get("confirmation") === "1";
  const selectedPaymentId = searchParams.get("paymentId") ?? "";

  useEffect(() => {
    let active = true;

    if (!token) {
      return () => {
        active = false;
      };
    }

    setIsLoading(true);
    void Promise.all([
      orderApi.getOrderById(token, orderId),
      orderApi.getOrderEvents(token, orderId).catch(() => ({ data: [] as OrderEvent[] })),
      paymentApi.listPaymentsByOrder(token, orderId).catch(() => ({ data: [] as Payment[] })),
    ])
      .then(async ([orderResponse, eventsResponse, paymentsResponse]) => {
        if (!active) {
          return;
        }

        setOrder(orderResponse.data);
        setEvents(eventsResponse.data);
        setPayments(paymentsResponse.data);

        const productIds = Array.from(new Set(orderResponse.data.items.map((item) => item.product_id).filter(Boolean)));
        const results = await Promise.allSettled(productIds.map((productId) => productApi.getProductById(productId)));
        const nextLookup: Record<string, Product> = {};
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            nextLookup[result.value.data.id] = result.value.data;
          }
        });
        if (active) {
          setProductLookup(nextLookup);
        }
      })
      .catch((reason) => {
        if (active) {
          setFeedback(getErrorMessage(reason));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [orderId, token]);

  async function handleCancelOrder() {
    if (!token || !order) {
      return;
    }

    try {
      setBusy(true);
      await orderApi.cancelOrder(token, order.id);
      const refreshedOrder = await orderApi.getOrderById(token, order.id);
      const refreshedEvents = await orderApi.getOrderEvents(token, order.id).catch(() => ({ data: [] as OrderEvent[] }));
      setOrder(refreshedOrder.data);
      setEvents(refreshedEvents.data);
      setFeedback("Đơn hàng đã được hủy.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  const latestPayment = selectedPaymentId
    ? payments.find((payment) => payment.id === selectedPaymentId) ?? payments[0]
    : payments[0];

  return (
    <AccountShell title={isConfirmation ? "Xác nhận đơn hàng" : "Chi tiết đơn hàng"} description="Theo dõi trạng thái đơn, timeline sự kiện, thanh toán và toàn bộ line items từ backend thật.">
      {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

      {isLoading ? (
        <LoadingScreen label="Đang tải chi tiết đơn hàng..." />
      ) : !order ? (
        <EmptyState title="Không tìm thấy đơn hàng" description="Order ID có thể không tồn tại hoặc bạn không có quyền truy cập." />
      ) : (
        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Order summary</p>
                <h2 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary">
                  {formatShortOrderId(order.id)}
                </h2>
                <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                  {formatLongDate(order.created_at)} · {formatShippingMethodLabel(order.shipping_method)}
                </p>
              </div>
              <div className="text-right">
                <StatusPill status={order.status} />
                <p className="mt-3 font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">
                  {formatCurrency(order.total_price)}
                </p>
              </div>
            </div>

            {latestPayment?.checkout_url ? (
              <div className="mt-6">
                <InlineAlert tone="info">
                  Payment provider đã trả về một hosted checkout URL. Bạn có thể mở lại bất cứ lúc nào tại{" "}
                  <a className="font-medium underline" href={latestPayment.checkout_url} rel="noreferrer" target="_blank">
                    đây
                  </a>
                  .
                </InlineAlert>
              </div>
            ) : null}

            {order.status === "pending" ? (
              <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "mt-6")} disabled={busy} onClick={() => void handleCancelOrder()}>
                {busy ? "Đang hủy..." : "Hủy đơn hàng"}
              </button>
            ) : null}
          </SurfaceCard>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <SurfaceCard className="p-6">
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Sản phẩm trong đơn</h3>
                <div className="mt-6 grid gap-4">
                  {order.items.map((item) => {
                    const product = productLookup[item.product_id];
                    return (
                      <div key={item.id} className="flex gap-4 rounded-[1.5rem] bg-surface p-4">
                        <div className="h-24 w-20 overflow-hidden rounded-[1rem] bg-surface-container-low">
                          <img alt={item.name} src={product?.image_urls[0] || product?.image_url || fallbackImageForProduct(item.name)} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-primary">{item.name}</p>
                          <p className="mt-2 text-sm text-on-surface-variant">{product?.brand || "Commerce Platform"}</p>
                          <p className="mt-2 text-sm text-on-surface-variant">Số lượng: {item.quantity}</p>
                        </div>
                        <strong className="text-sm text-primary">{formatCurrency(item.price * item.quantity)}</strong>
                      </div>
                    );
                  })}
                </div>
              </SurfaceCard>

              <SurfaceCard className="p-6">
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Timeline xử lý</h3>
                <div className="mt-6 space-y-4">
                  {events.length === 0 ? (
                    <p className="text-sm leading-7 text-on-surface-variant">Chưa có event timeline chi tiết.</p>
                  ) : (
                    events.map((event) => (
                      <div key={event.id} className="rounded-[1.25rem] bg-surface p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold text-primary">{event.message || formatStatusLabel(event.status)}</p>
                          <StatusPill status={event.status} />
                        </div>
                        <p className="mt-2 text-sm text-on-surface-variant">{formatDateTime(event.created_at)}</p>
                      </div>
                    ))
                  )}
                </div>
              </SurfaceCard>
            </div>

            <div className="space-y-6">
              <SurfaceCard className="p-6">
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Tổng thanh toán</h3>
                <div className="mt-6 space-y-3 text-sm text-on-surface-variant">
                  <div className="flex items-center justify-between">
                    <span>Tạm tính</span>
                    <strong className="text-primary">{formatCurrency(order.subtotal_price)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Giảm giá</span>
                    <strong className="text-primary">-{formatCurrency(order.discount_amount)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{formatShippingMethodLabel(order.shipping_method)}</span>
                    <strong className="text-primary">{formatCurrency(order.shipping_fee)}</strong>
                  </div>
                  <div className="flex items-center justify-between border-t border-outline-variant/20 pt-3">
                    <span>Tổng cộng</span>
                    <strong className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">{formatCurrency(order.total_price)}</strong>
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard className="p-6">
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Thanh toán</h3>
                <div className="mt-6 space-y-4">
                  {payments.length === 0 ? (
                    <p className="text-sm leading-7 text-on-surface-variant">Chưa có payment records cho đơn này.</p>
                  ) : (
                    payments.map((payment) => (
                      <div key={payment.id} className="rounded-[1.25rem] bg-surface p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-primary">{humanizeToken(payment.payment_method)} · {humanizeToken(payment.gateway_provider)}</p>
                          <StatusPill status={payment.status} />
                        </div>
                        <p className="mt-2 text-sm text-on-surface-variant">{formatDateTime(payment.created_at)}</p>
                        <p className="mt-2 text-sm text-on-surface-variant">Số tiền: {formatCurrency(payment.amount)}</p>
                      </div>
                    ))
                  )}
                </div>
              </SurfaceCard>
            </div>
          </div>
        </div>
      )}
    </AccountShell>
  );
}

export function AddressesPageView() {
  const { token } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({
    recipient_name: "",
    phone: "",
    street: "",
    ward: "",
    district: "",
    city: "",
    is_default: false,
  });

  const reload = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await userApi.listAddresses(token);
      setAddresses(response.data);
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function resetForm() {
    setEditingId("");
    setForm({
      recipient_name: "",
      phone: "",
      street: "",
      ward: "",
      district: "",
      city: "",
      is_default: false,
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      if (editingId) {
        await userApi.updateAddress(token, editingId, form);
        setFeedback("Địa chỉ đã được cập nhật.");
      } else {
        await userApi.createAddress(token, form);
        setFeedback("Địa chỉ mới đã được lưu.");
      }
      resetForm();
      await reload();
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(addressId: string) {
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      await userApi.deleteAddress(token, addressId);
      setFeedback("Địa chỉ đã được xóa.");
      await reload();
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleSetDefault(addressId: string) {
    if (!token) {
      return;
    }

    try {
      setBusy(true);
      await userApi.setDefaultAddress(token, addressId);
      setFeedback("Đã cập nhật địa chỉ mặc định.");
      await reload();
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell title="Địa chỉ giao hàng" description="Quản lý đầy đủ create, update, delete và set default cho địa chỉ người dùng bằng API thật của user-service.">
      {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <SurfaceCard className="p-6">
          <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
            {editingId ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}
          </h2>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <TextInput placeholder="Tên người nhận" value={form.recipient_name} onChange={(event) => setForm((current) => ({ ...current, recipient_name: event.target.value }))} />
            <TextInput placeholder="Số điện thoại" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            <TextInput placeholder="Địa chỉ" value={form.street} onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))} />
            <TextInput placeholder="Phường / xã" value={form.ward} onChange={(event) => setForm((current) => ({ ...current, ward: event.target.value }))} />
            <TextInput placeholder="Quận / huyện" value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} />
            <TextInput placeholder="Tỉnh / thành phố" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
            <label className="flex items-center gap-3 text-sm text-on-surface-variant">
              <input checked={form.is_default} type="checkbox" onChange={(event) => setForm((current) => ({ ...current, is_default: event.target.checked }))} />
              Đặt làm địa chỉ mặc định
            </label>
            <div className="flex flex-col gap-3">
              <button type="submit" className={cn(buttonStyles({ size: "lg" }), "w-full")} disabled={busy}>
                {busy ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Tạo địa chỉ"}
              </button>
              {editingId ? (
                <button type="button" className={cn(buttonStyles({ variant: "secondary", size: "lg" }), "w-full")} onClick={resetForm}>
                  Hủy chỉnh sửa
                </button>
              ) : null}
            </div>
          </form>
        </SurfaceCard>

        <div>
          {isLoading ? (
            <LoadingScreen label="Đang tải sổ địa chỉ..." />
          ) : addresses.length === 0 ? (
            <EmptyState title="Chưa có địa chỉ" description="Tạo địa chỉ đầu tiên để checkout nhanh hơn trong các lần mua tiếp theo." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {addresses.map((address) => (
                <SurfaceCard key={address.id} className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-primary">{address.recipient_name}</p>
                      <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                        {address.street}
                        <br />
                        {[address.ward, address.district, address.city].filter(Boolean).join(", ")}
                      </p>
                      <p className="mt-2 text-sm text-on-surface-variant">{address.phone}</p>
                    </div>
                    {address.is_default ? <StatusPill status="default" /> : null}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" className={buttonStyles({ variant: "secondary" })} onClick={() => { setEditingId(address.id); setForm({ ...address, ward: address.ward || "" }); }}>
                      Sửa
                    </button>
                    {!address.is_default ? (
                      <button type="button" className={buttonStyles({ variant: "secondary" })} onClick={() => void handleSetDefault(address.id)}>
                        Đặt mặc định
                      </button>
                    ) : null}
                    <button type="button" className={buttonStyles({ variant: "tertiary" })} onClick={() => void handleDelete(address.id)}>
                      Xóa
                    </button>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </AccountShell>
  );
}

export function PaymentsPageView() {
  const { token } = useAuth();
  const { orders, paymentsByOrder, isLoading, error } = useOrderPayments(token);

  const paymentEntries = useMemo(
    () =>
      orders
        .flatMap((order) => (paymentsByOrder[order.id] ?? []).map((payment) => ({ payment, order })))
        .sort((left, right) => Date.parse(right.payment.created_at) - Date.parse(left.payment.created_at)),
    [orders, paymentsByOrder],
  );

  const totalPaid = paymentEntries.reduce((sum, entry) => {
    const direction = entry.payment.transaction_type === "refund" ? -1 : 1;
    return sum + entry.payment.amount * direction;
  }, 0);

  return (
    <AccountShell title="Lịch sử thanh toán" description="Mọi payment records đang được tổng hợp từ payment-service và gắn ngược lại order tương ứng để dễ audit.">
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <div className="grid gap-5 md:grid-cols-3">
        <SurfaceCard className="p-6">
          <p className="eyebrow">Transactions</p>
          <p className="mt-4 font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">{paymentEntries.length}</p>
        </SurfaceCard>
        <SurfaceCard className="p-6">
          <p className="eyebrow">Net paid</p>
          <p className="mt-4 font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">{formatCurrency(totalPaid)}</p>
        </SurfaceCard>
        <SurfaceCard className="p-6">
          <p className="eyebrow">Orders</p>
          <p className="mt-4 font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">{orders.length}</p>
        </SurfaceCard>
      </div>

      {isLoading ? (
        <LoadingScreen label="Đang tải lịch sử thanh toán..." />
      ) : paymentEntries.length === 0 ? (
        <EmptyState title="Chưa có giao dịch nào" description="Sau khi thanh toán thành công, payment records sẽ xuất hiện tại đây." />
      ) : (
        <div className="space-y-4">
          {paymentEntries.map(({ payment, order }) => (
            <Link key={payment.id} href={`/orders/${payment.order_id}`} className="block rounded-[2rem] bg-surface-container-low p-6 transition hover:-translate-y-1">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-primary">{formatShortOrderId(payment.order_id)}</p>
                  <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                    {formatDateTime(payment.created_at)} · {humanizeToken(payment.payment_method)} · {humanizeToken(payment.gateway_provider)}
                  </p>
                  <p className="mt-2 text-sm text-on-surface-variant">Đơn hàng tạo ngày {formatShortDate(order.created_at)}</p>
                </div>
                <div className="text-right">
                  <StatusPill status={payment.status} />
                  <p className="mt-3 font-semibold text-primary">{formatCurrency(payment.amount)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AccountShell>
  );
}

export function SecurityPageView() {
  const { user, changePassword, resendVerificationEmail, token } = useAuth();
  const { orders, paymentsByOrder } = useOrderPayments(token);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const latestPayment = useMemo(
    () =>
      Object.values(paymentsByOrder)
        .flat()
        .slice()
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0],
    [paymentsByOrder],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setFeedback("Mật khẩu mới cần tối thiểu 8 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    try {
      setBusy(true);
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback("Mật khẩu đã được cập nhật.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendVerification() {
    try {
      setBusy(true);
      await resendVerificationEmail();
      setFeedback("Email xác minh mới đã được gửi.");
    } catch (reason) {
      setFeedback(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountShell title="Bảo mật tài khoản" description="Đổi mật khẩu bằng API thật của user-service và theo dõi các tín hiệu hoạt động gần nhất của tài khoản.">
      {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SurfaceCard className="p-6">
          <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">Đổi mật khẩu</h2>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <TextInput autoComplete="current-password" placeholder="Mật khẩu hiện tại" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            <TextInput autoComplete="new-password" placeholder="Mật khẩu mới" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            <TextInput autoComplete="new-password" placeholder="Xác nhận mật khẩu mới" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            <button type="submit" className={cn(buttonStyles({ size: "lg" }), "w-full")} disabled={busy}>
              {busy ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
            </button>
          </form>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Xác minh email</h3>
          <p className="mt-4 text-sm leading-7 text-on-surface-variant">
            {user?.email_verified ? "Email đã được xác minh." : "Email chưa được xác minh. Hãy gửi lại email xác minh để tăng độ an toàn của tài khoản."}
          </p>
          {!user?.email_verified ? (
            <button type="button" className={cn(buttonStyles({ variant: "secondary" }), "mt-6 w-full")} disabled={busy} onClick={() => void handleResendVerification()}>
              Gửi lại email xác minh
            </button>
          ) : null}
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-6">
        <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Hoạt động gần đây</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.25rem] bg-surface p-4">
            <p className="font-semibold text-primary">Email tài khoản</p>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">{user?.email}</p>
          </div>
          <div className="rounded-[1.25rem] bg-surface p-4">
            <p className="font-semibold text-primary">Đơn hàng gần nhất</p>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">{orders[0] ? formatLongDate(orders[0].updated_at) : "Chưa có dữ liệu"}</p>
          </div>
          <div className="rounded-[1.25rem] bg-surface p-4">
            <p className="font-semibold text-primary">Thanh toán gần nhất</p>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">{latestPayment ? formatLongDate(latestPayment.created_at) : "Chưa có dữ liệu"}</p>
          </div>
        </div>
      </SurfaceCard>
    </AccountShell>
  );
}

export function NotificationsPageView() {
  const { token, user } = useAuth();
  const { orders, paymentsByOrder } = useOrderPayments(token);
  const [prefs, setPrefs] = useState({
    emailAlerts: true,
    smsNotifications: false,
    orderUpdates: true,
    securityAlerts: true,
  });

  const latestPayment = useMemo(
    () =>
      Object.values(paymentsByOrder)
        .flat()
        .slice()
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0],
    [paymentsByOrder],
  );

  const feed = useMemo(() => {
    const items = [];

    if (orders[0]) {
      items.push({
        id: `order-${orders[0].id}`,
        title: `Đơn ${formatShortOrderId(orders[0].id)} đang ở trạng thái ${formatStatusLabel(orders[0].status)}`,
        description: `Cập nhật gần nhất vào ${formatShortDate(orders[0].updated_at)}.`,
        href: `/orders/${orders[0].id}`,
      });
    }

    if (latestPayment) {
      items.push({
        id: `payment-${latestPayment.id}`,
        title: `${humanizeToken(latestPayment.payment_method)} ${formatStatusLabel(latestPayment.status)}`,
        description: `${formatCurrency(latestPayment.amount)} qua ${humanizeToken(latestPayment.gateway_provider)}.`,
        href: `/orders/${latestPayment.order_id}`,
      });
    }

    items.push({
      id: "security",
      title: user?.email_verified ? "Email đã xác minh" : "Email cần xác minh",
      description: user?.email_verified
        ? "Tài khoản đã sẵn sàng cho các luồng recovery và security notice."
        : "Hãy xác minh email để tăng mức bảo vệ cho tài khoản.",
      href: "/security",
    });

    return items;
  }, [latestPayment, orders, user?.email_verified]);

  return (
    <AccountShell title="Thông báo & activity" description="Trang này gom các tín hiệu quan trọng từ orders, payments và trạng thái tài khoản để người dùng xử lý nhanh hơn.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["emailAlerts", "Email alerts", "Nhận tóm tắt đơn hàng và cập nhật giao dịch qua email."],
          ["smsNotifications", "SMS notifications", "Thông báo ngắn gọn cho các trạng thái cần chú ý."],
          ["orderUpdates", "Order updates", "Cập nhật mọi bước xử lý đơn hàng."],
          ["securityAlerts", "Security alerts", "Nhắc nhở về email verification và password changes."],
        ].map(([key, title, description]) => (
          <SurfaceCard key={key} className="p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-primary">{title}</p>
              <input checked={prefs[key as keyof typeof prefs]} type="checkbox" onChange={(event) => setPrefs((current) => ({ ...current, [key]: event.target.checked }))} />
            </div>
            <p className="mt-4 text-sm leading-7 text-on-surface-variant">{description}</p>
          </SurfaceCard>
        ))}
      </div>

      <SurfaceCard className="p-6">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">Activity feed</h2>
        <div className="mt-6 grid gap-4">
          {feed.map((item) => (
            <Link key={item.id} href={item.href} className="rounded-[1.5rem] bg-surface p-5 transition hover:bg-surface-container-high">
              <p className="font-semibold text-primary">{item.title}</p>
              <p className="mt-3 text-sm leading-7 text-on-surface-variant">{item.description}</p>
            </Link>
          ))}
        </div>
      </SurfaceCard>
    </AccountShell>
  );
}
