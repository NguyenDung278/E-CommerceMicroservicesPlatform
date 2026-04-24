"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AccountShell } from "@/components/account-shared/account-shell";
import { StorefrontImage } from "@/components/storefront-shared/storefront-image";
import {
  EmptyState,
  InlineAlert,
  LoadingScreen,
  StatusPill,
  SurfaceCard,
} from "@/components/storefront-shared/storefront-ui";
import { useAuth } from "@/hooks/useAuth";
import { orderApi, paymentApi } from "@/lib/api";
import { buttonStyles } from "@/lib/button-styles";
import { getErrorMessage } from "@/lib/errors/handler";
import { invalidateOrderPaymentsResource } from "@/lib/resources/account-resources";
import { readProductLookupResource } from "@/lib/resources/product-resources";
import { fallbackImageForProduct } from "@/lib/utils";
import type {
  Order,
  OrderEvent,
  Payment,
  Product,
  ReturnEligibilitySnapshot,
  ReturnRequest,
} from "@/types/api";
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
  const [returnEligibility, setReturnEligibility] = useState<ReturnEligibilitySnapshot | null>(
    null,
  );
  const [orderReturns, setOrderReturns] = useState<ReturnRequest[]>([]);
  const [productLookup, setProductLookup] = useState<Record<string, Product>>({});
  const [feedback, setFeedback] = useState("");
  const [returnFeedback, setReturnFeedback] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnItemReasons, setReturnItemReasons] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

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
      orderApi.getReturnEligibility(token, orderId).catch(
        () => ({ data: null as ReturnEligibilitySnapshot | null }),
      ),
      orderApi.listReturnsByOrder(token, orderId).catch(() => ({ data: [] as ReturnRequest[] })),
    ])
      .then(
        async ([
          orderResponse,
          eventsResponse,
          paymentsResponse,
          eligibilityResponse,
          returnsResponse,
        ]) => {
        if (!active) {
          return;
        }

        setOrder(orderResponse.data);
        setEvents(eventsResponse.data);
        setPayments(paymentsResponse.data);
        setReturnEligibility(eligibilityResponse.data);
        setOrderReturns(returnsResponse.data);

        const productIds = Array.from(
          new Set(orderResponse.data.items.map((item) => item.product_id).filter(Boolean)),
        );
        const nextLookup = await readProductLookupResource(productIds);
        if (active) {
          setProductLookup(nextLookup);
        }
        },
      )
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

  const sortedReturns = useMemo(
    () => [...orderReturns].sort((left, right) => right.created_at.localeCompare(left.created_at)),
    [orderReturns],
  );
  const returnableItems = useMemo(() => returnEligibility?.items ?? [], [returnEligibility]);
  const hasReturnableItems = returnableItems.some(
    (item) => item.eligible && item.remaining_quantity > 0,
  );
  const canRequestReturn = Boolean(returnEligibility?.eligible && hasReturnableItems);

  async function handleCancelOrder() {
    if (!token || !order) {
      return;
    }

    try {
      setBusy(true);
      await orderApi.cancelOrder(token, order.id);
      invalidateOrderPaymentsResource(token);
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

  async function handleSubmitReturn() {
    if (!token || !order) {
      setReturnFeedback("Bạn cần đăng nhập để gửi yêu cầu trả hàng.");
      return;
    }

    const normalizedReason = returnReason.trim();
    const selectedItems = returnableItems
      .map((item) => ({
        order_item_id: item.order_item_id,
        quantity: Math.max(
          0,
          Math.min(item.remaining_quantity, returnQuantities[item.order_item_id] ?? 0),
        ),
        reason: returnItemReasons[item.order_item_id]?.trim() || undefined,
      }))
      .filter((item) => item.quantity > 0);

    if (!normalizedReason) {
      setReturnFeedback("Hãy điền lý do chung cho yêu cầu trả hàng.");
      return;
    }
    if (selectedItems.length === 0) {
      setReturnFeedback("Hãy chọn ít nhất một mặt hàng và số lượng cần trả.");
      return;
    }

    try {
      setIsSubmittingReturn(true);
      const response = await orderApi.createReturn(token, order.id, {
        reason: normalizedReason,
        items: selectedItems,
      });
      const [eligibilityResponse, returnsResponse] = await Promise.allSettled([
        orderApi.getReturnEligibility(token, order.id),
        orderApi.listReturnsByOrder(token, order.id),
      ]);

      setOrderReturns((current) => [response.data, ...current]);
      if (eligibilityResponse.status === "fulfilled") {
        setReturnEligibility(eligibilityResponse.value.data);
      }
      if (returnsResponse.status === "fulfilled") {
        setOrderReturns(returnsResponse.value.data);
      }
      setReturnReason("");
      setReturnQuantities({});
      setReturnItemReasons({});
      setReturnFeedback(`Đã tạo yêu cầu trả hàng ${response.data.id}.`);
    } catch (reason) {
      setReturnFeedback(getErrorMessage(reason));
    } finally {
      setIsSubmittingReturn(false);
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
          <SurfaceCard className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">{isConfirmation ? "Thank you" : "Order details"}</p>
                <h2 className="mt-4 font-serif text-4xl font-semibold tracking-[-0.04em] text-primary md:text-5xl">
                  {isConfirmation ? "Order placed successfully." : formatShortOrderId(order.id)}
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-on-surface-variant md:text-base">
                  {isConfirmation
                    ? "Your order has been placed successfully and is now being prepared with care in our atelier."
                    : "Review the latest order snapshot, payment state, shipping details and aftercare options in one place."}
                </p>
              </div>
              <div className="text-right">
                <StatusPill status={order.status} />
                <p className="mt-3 font-serif text-4xl font-semibold tracking-[-0.03em] text-primary">
                  {formatCurrency(order.total_price)}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Order number
                </p>
                <p className="mt-4 font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                  #{order.id}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Estimated arrival
                </p>
                <p className="mt-4 text-sm font-medium leading-7 text-primary">
                  {formatArrivalWindow(order.created_at)}
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-[#f6f1ea] px-5 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                  Shipping to
                </p>
                {order.shipping_address ? (
                  <div className="mt-4 text-sm leading-7 text-primary">
                    <p className="font-medium">{order.shipping_address.recipient_name}</p>
                    <p>{order.shipping_address.phone}</p>
                    <p>{order.shipping_address.location}</p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-7 text-primary">
                    Pickup order. Shipping address was not required.
                  </p>
                )}
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
              <div className="mt-6">
                <button
                  type="button"
                  className={`${buttonStyles({ variant: "secondary", size: "lg" })}`}
                  disabled={busy}
                  onClick={() => void handleCancelOrder()}
                >
                  {busy ? "Đang hủy..." : "Hủy đơn hàng"}
                </button>
              </div>
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
                            {product?.brand || "ND Shop"}
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

              <SurfaceCard className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                      Returns for this order
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                      Tạo return request, xem history theo từng order và theo dõi refund state từ
                      backend thật.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <StatusPill
                      status={`${returnableItems.filter((item) => item.eligible && item.remaining_quantity > 0).length} returnable lines`}
                    />
                    <Link href="/returns" className="text-sm font-medium text-primary underline">
                      Open returns center
                    </Link>
                  </div>
                </div>

                {returnFeedback ? (
                  <div className="mt-6">
                    <InlineAlert tone="info">{returnFeedback}</InlineAlert>
                  </div>
                ) : null}

                {canRequestReturn ? (
                  <div className="mt-6 space-y-5">
                    {returnEligibility?.return_window_expires_at ? (
                      <p className="text-sm leading-7 text-on-surface-variant">
                        Return window closes at{" "}
                        {formatDateTime(returnEligibility.return_window_expires_at)}.
                      </p>
                    ) : null}

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                        Overall reason
                      </span>
                      <textarea
                        className="min-h-28 w-full rounded-[1rem] border border-outline-variant/30 bg-background px-4 py-3 text-sm text-primary outline-none"
                        placeholder="Example: wrong size, damaged packaging, or product mismatch"
                        value={returnReason}
                        onChange={(event) => setReturnReason(event.target.value)}
                      />
                    </label>

                    <div className="space-y-4">
                      {returnableItems.map((item) => (
                        <div
                          key={item.order_item_id}
                          className="rounded-[1.25rem] bg-surface p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-primary">{item.product_name}</p>
                              <p className="mt-1 text-sm text-on-surface-variant">
                                Purchased {item.ordered_quantity} · Already requested{" "}
                                {item.already_requested_quantity} · Remaining{" "}
                                {item.remaining_quantity}
                              </p>
                              {item.reason ? (
                                <p className="mt-1 text-sm text-on-surface-variant">
                                  {item.reason}
                                </p>
                              ) : null}
                            </div>
                            <StatusPill
                              status={
                                item.eligible && item.remaining_quantity > 0 ? "eligible" : "locked"
                              }
                            />
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
                            <label className="space-y-2">
                              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                                Quantity
                              </span>
                              <select
                                className="w-full rounded-[1rem] border border-outline-variant/30 bg-background px-4 py-3 text-sm text-primary outline-none"
                                disabled={!item.eligible || item.remaining_quantity === 0}
                                value={String(returnQuantities[item.order_item_id] ?? 0)}
                                onChange={(event) =>
                                  setReturnQuantities((current) => ({
                                    ...current,
                                    [item.order_item_id]: Math.max(
                                      0,
                                      Math.min(
                                        item.remaining_quantity,
                                        Number.parseInt(event.target.value, 10) || 0,
                                      ),
                                    ),
                                  }))
                                }
                              >
                                {Array.from({ length: item.remaining_quantity + 1 }, (_, index) => (
                                  <option key={`${item.order_item_id}-${index}`} value={index}>
                                    {index}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="space-y-2">
                              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                                Line note
                              </span>
                              <input
                                className="w-full rounded-[1rem] border border-outline-variant/30 bg-background px-4 py-3 text-sm text-primary outline-none"
                                disabled={!item.eligible || item.remaining_quantity === 0}
                                placeholder="Optional note for this item"
                                value={returnItemReasons[item.order_item_id] ?? ""}
                                onChange={(event) =>
                                  setReturnItemReasons((current) => ({
                                    ...current,
                                    [item.order_item_id]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className={buttonStyles()}
                      disabled={isSubmittingReturn}
                      onClick={() => void handleSubmitReturn()}
                    >
                      {isSubmittingReturn ? "Submitting..." : "Request return"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 rounded-[1.25rem] bg-surface p-4 text-sm leading-7 text-on-surface-variant">
                    {returnEligibility?.reason ||
                      "Return request is unavailable for this order right now."}
                  </div>
                )}

                {sortedReturns.length > 0 ? (
                  <div className="mt-6 space-y-4">
                    {sortedReturns.map((returnRequest) => (
                      <div key={returnRequest.id} className="rounded-[1.25rem] bg-surface p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <Link
                              href={`/returns/${returnRequest.id}`}
                              className="font-semibold text-primary underline"
                            >
                              {returnRequest.id}
                            </Link>
                            <p className="mt-1 text-sm text-on-surface-variant">
                              Created {formatDateTime(returnRequest.created_at)}
                            </p>
                          </div>
                          <StatusPill status={returnRequest.status} />
                        </div>
                        <p className="mt-3 text-sm text-on-surface-variant">
                          {returnRequest.reason}
                        </p>
                        <p className="mt-2 text-sm text-on-surface-variant">
                          Refund: {buildReturnRefundCopy(returnRequest)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-[1.25rem] bg-surface p-4 text-sm leading-7 text-on-surface-variant">
                    No return requests have been created for this order yet.
                  </div>
                )}
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

              <SurfaceCard className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
                    Return eligibility
                  </h3>
                  {returnEligibility ? (
                    <StatusPill status={returnEligibility.eligible ? "eligible" : "locked"} />
                  ) : null}
                </div>

                {!returnEligibility ? (
                  <p className="mt-6 text-sm leading-7 text-on-surface-variant">
                    Chưa tải được snapshot eligibility cho đơn này.
                  </p>
                ) : (
                  <div className="mt-6 space-y-4">
                    <p className="text-sm leading-7 text-on-surface-variant">
                      {returnEligibility.reason ||
                        "Backend snapshot này là source of truth cho số lượng còn có thể trả của từng line item."}
                    </p>

                    {returnEligibility.return_window_expires_at ? (
                      <p className="text-sm leading-7 text-on-surface-variant">
                        Return window closes at{" "}
                        {formatDateTime(returnEligibility.return_window_expires_at)}.
                      </p>
                    ) : null}

                    <div className="space-y-3">
                      {returnEligibility.items.map((item) => (
                        <div
                          key={item.order_item_id}
                          className="rounded-[1.25rem] bg-surface p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-semibold text-primary">{item.product_name}</p>
                            <StatusPill
                              status={item.eligible && item.remaining_quantity > 0 ? "eligible" : "locked"}
                            />
                          </div>
                          <p className="mt-2 text-sm text-on-surface-variant">
                            Đã mua {item.ordered_quantity} · Đã yêu cầu {item.already_requested_quantity}
                            {" "}· Còn lại {item.remaining_quantity}
                          </p>
                          {item.reason ? (
                            <p className="mt-2 text-sm text-on-surface-variant">{item.reason}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    {returnEligibility.eligible ? (
                      <Link
                        href={`/orders/${order.id}`}
                        className="inline-flex text-sm font-medium text-primary underline"
                      >
                        Refresh order snapshot
                      </Link>
                    ) : null}
                  </div>
                )}
              </SurfaceCard>
            </div>
          </div>
        </div>
      )}
    </AccountShell>
  );
}

function buildReturnRefundCopy(returnRequest: ReturnRequest) {
  if (typeof returnRequest.refund_amount !== "number") {
    return "Chờ review";
  }

  if (returnRequest.status === "refunded") {
    return formatCurrency(returnRequest.refund_amount);
  }

  if (returnRequest.status === "refund_pending") {
    return `${formatCurrency(returnRequest.refund_amount)} đang chờ xử lý`;
  }

  return `${formatCurrency(returnRequest.refund_amount)} dự kiến`;
}

function formatArrivalWindow(createdAt: string) {
  const createdDate = new Date(createdAt);

  if (Number.isNaN(createdDate.getTime())) {
    return "Updating delivery estimate";
  }

  const start = new Date(createdDate);
  start.setDate(start.getDate() + 3);

  const end = new Date(createdDate);
  end.setDate(end.getDate() + 7);

  return `${formatLongDate(start.toISOString())} - ${formatLongDate(end.toISOString())}`;
}
