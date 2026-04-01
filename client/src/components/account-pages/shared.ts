"use client";

import { CreditCard, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { readProductLookupResource } from "@/lib/resources/product-resources";
import { fallbackImageForProduct } from "@/lib/utils";
import type { Order, Payment, Product } from "@/types/api";

const memberSinceFormatter = new Intl.DateTimeFormat("vi-VN", {
  month: "long",
  year: "numeric",
});

export type ProfileFieldErrors = Partial<
  Record<
    | "firstName"
    | "lastName"
    | "phone"
    | "recipientName"
    | "street"
    | "district"
    | "city"
    | "otpCode",
    string
  >
>;

export type ProfileFeedback = {
  tone: "info" | "error" | "success";
  message: string;
};

export function formatMemberSince(createdAt?: string) {
  if (!createdAt) {
    return "Tài khoản mới kích hoạt";
  }

  const parsedDate = new Date(createdAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Tài khoản đã kích hoạt";
  }

  return `Thành viên từ ${memberSinceFormatter.format(parsedDate)}`;
}

export function normalizeInputText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizePhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }

  return digits;
}

export function isValidVietnamesePhone(value: string) {
  return /^0\d{9}$/.test(value);
}

export function isValidStoredPhone(value: string) {
  return /^0\d{9,10}$/.test(value);
}

export function formatSecondsLabel(seconds: number) {
  if (seconds <= 0) {
    return "0s";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return remainingSeconds === 0 ? `${minutes}m` : `${minutes}m ${remainingSeconds}s`;
}

export function getLeadOrderItem(order: Order) {
  return order.items[0] ?? null;
}

export function getOrderPreviewImage(order: Order, productLookup: Record<string, Product>) {
  const leadItem = getLeadOrderItem(order);

  if (!leadItem) {
    return fallbackImageForProduct("Đơn hàng");
  }

  const product = productLookup[leadItem.product_id];
  return product?.image_urls[0] || product?.image_url || fallbackImageForProduct(leadItem.name);
}

export function getPaymentMethodIcon(method: string) {
  return method === "credit_card" ? CreditCard : Wallet;
}

export function flattenPaymentsByOrder(paymentsByOrder: Record<string, Payment[]>) {
  return Object.values(paymentsByOrder).flat();
}

export function getNetPaidAmount(paymentsByOrder: Record<string, Payment[]>) {
  return flattenPaymentsByOrder(paymentsByOrder).reduce((sum, payment) => {
    const direction = payment.transaction_type === "refund" ? -1 : 1;
    return sum + payment.amount * direction;
  }, 0);
}

export function getLatestPayment(paymentsByOrder: Record<string, Payment[]>) {
  return flattenPaymentsByOrder(paymentsByOrder)
    .slice()
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0];
}

export function useOrderProductLookup(orders: Order[]) {
  const previewProductIds = useMemo(
    () =>
      Array.from(
        new Set(
          orders
            .map((order) => getLeadOrderItem(order)?.product_id)
            .filter((productId): productId is string => Boolean(productId)),
        ),
      ),
    [orders],
  );
  const [productLookup, setProductLookup] = useState<Record<string, Product>>({});

  useEffect(() => {
    let active = true;

    if (previewProductIds.length === 0) {
      return () => {
        active = false;
      };
    }

    void readProductLookupResource(previewProductIds)
      .then((nextLookup) => {
        if (!active) {
          return;
        }

        setProductLookup(nextLookup);
      })
      .catch(() => {
        if (active) {
          setProductLookup({});
        }
      });

    return () => {
      active = false;
    };
  }, [previewProductIds]);

  return useMemo(
    () =>
      Object.fromEntries(
        previewProductIds
          .map((productId) => [productId, productLookup[productId]] as const)
          .filter((entry): entry is [string, Product] => Boolean(entry[1])),
      ),
    [previewProductIds, productLookup],
  );
}
