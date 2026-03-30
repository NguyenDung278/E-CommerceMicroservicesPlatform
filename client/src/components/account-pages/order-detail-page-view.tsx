"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AccountShell } from "@/components/account-shell";
import { StorefrontImage } from "@/components/storefront-image";
import {
  EmptyState,
  InlineAlert,
  LoadingScreen,
  StatusPill,
  SurfaceCard,
} from "@/components/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { orderApi, paymentApi, productApi } from "@/lib/api";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { fallbackImageForProduct } from "@/lib/utils";
import type { Order, OrderEvent, Payment, Product } from "@/types/api";
import {
  formatCurrency,
  formatDateTime,
  formatLongDate,
  formatShippingMethodLabel,
  formatShortOrderId,
  formatStatusLabel,
  humanizeToken,
} from "@/utils/format";

type OrderDetailPageViewProps = {
  orderId: string;
};

export function OrderDetailPageView({ orderId }: OrderDetailPageViewProps) {
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

        const productIds = Array.from(
          new Set(orderResponse.data.items.map((item) => item.product_id).filter(Boolean)),
        );
        const results = await Promise.allSettled(
          productIds.map((productId) => productApi.getProductById(productId)),
        );
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
      const refreshedEvents = await orderApi
        .getOrderEvents(token, order.id)
        .catch(() => ({ data: [] as OrderEvent[] }));
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
    <AccountShell
      title={isConfirmation ? "Xác nhận đơn hàng" : "Chi tiết đơn hàng"}
      description="Theo dõi trạng thái đơn, timeline sự kiện, thanh toán và toàn bộ line items từ backend thật."
    >
      {feedback ? <InlineAlert tone="info">{feedback}</InlineAlert> : null}

      {isLoading ? (
        <LoadingScreen label="Đang tải chi tiết đơn hàng..." />
      ) : !order ? (
        <EmptyState
          title="Không tìm thấy đơn hàng"
          description="Order ID có thể không tồn tại hoặc bạn không có quyền truy cập."
        />
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
              <button
                type="button"
                className={`${buttonStyles({ variant: "secondary", size: "lg" })} mt-6`}
                disabled={busy}
                onClick={() => void handleCancelOrder()}
              >
                {busy ? "Đang hủy..." : "Hủy đơn hàng"}
              </button>
            ) : null}
          </SurfaceCard>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              <SurfaceCard className="p-6">
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  Sản phẩm trong đơn
                </h3>
                <div className="mt-6 grid gap-4">
                  {order.items.map((item) => {
                    const product = productLookup[item.product_id];
                    return (
                      <div key={item.id} className="flex gap-4 rounded-[1.5rem] bg-surface p-4">
                        <div className="relative h-24 w-20 overflow-hidden rounded-[1rem] bg-surface-container-low">
                          <StorefrontImage
                            alt={item.name}
                            src={
                              product?.image_urls[0] ||
                              product?.image_url ||
                              fallbackImageForProduct(item.name)
                            }
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-primary">{item.name}</p>
                          <p className="mt-2 text-sm text-on-surface-variant">
                            {product?.brand || "Commerce Platform"}
                          </p>
                          <p className="mt-2 text-sm text-on-surface-variant">Số lượng: {item.quantity}</p>
                        </div>
                        <strong className="text-sm text-primary">
                          {formatCurrency(item.price * item.quantity)}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </SurfaceCard>

              <SurfaceCard className="p-6">
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  Timeline xử lý
                </h3>
                <div className="mt-6 space-y-4">
                  {events.length === 0 ? (
                    <p className="text-sm leading-7 text-on-surface-variant">
                      Chưa có event timeline chi tiết.
                    </p>
                  ) : (
                    events.map((event) => (
                      <div key={event.id} className="rounded-[1.25rem] bg-surface p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-semibold text-primary">
                            {event.message || formatStatusLabel(event.status)}
                          </p>
                          <StatusPill status={event.status} />
                        </div>
                        <p className="mt-2 text-sm text-on-surface-variant">
                          {formatDateTime(event.created_at)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </SurfaceCard>
            </div>

            <div className="space-y-6">
              <SurfaceCard className="p-6">
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  Tổng thanh toán
                </h3>
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
                    <strong className="font-serif text-3xl font-semibold tracking-[-0.03em] text-primary">
                      {formatCurrency(order.total_price)}
                    </strong>
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard className="p-6">
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">Thanh toán</h3>
                <div className="mt-6 space-y-4">
                  {payments.length === 0 ? (
                    <p className="text-sm leading-7 text-on-surface-variant">
                      Chưa có payment records cho đơn này.
                    </p>
                  ) : (
                    payments.map((payment) => (
                      <div key={payment.id} className="rounded-[1.25rem] bg-surface p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-primary">
                            {humanizeToken(payment.payment_method)} ·{" "}
                            {humanizeToken(payment.gateway_provider)}
                          </p>
                          <StatusPill status={payment.status} />
                        </div>
                        <p className="mt-2 text-sm text-on-surface-variant">
                          {formatDateTime(payment.created_at)}
                        </p>
                        <p className="mt-2 text-sm text-on-surface-variant">
                          Số tiền: {formatCurrency(payment.amount)}
                        </p>
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
