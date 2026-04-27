"use client";

import { cn } from "@/lib/utils";

import {
  checkoutPaymentOptions,
  type PaymentChoice,
} from "@/components/storefront/checkout/checkout-shared";

export function CheckoutPaymentSection({
  paymentMethod,
  onChange,
}: {
  paymentMethod: PaymentChoice;
  onChange: (value: PaymentChoice) => void;
}) {
  return (
    <section className="commerce-section">
      <h2 className="text-lg font-semibold text-on-surface">Thanh toán</h2>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {checkoutPaymentOptions.map((option) => (
          <label
            key={option.value}
            className={cn(
              "rounded-[var(--radius-lg)] border p-4 text-sm transition",
              paymentMethod === option.value
                ? "border-primary bg-[#fff4f1] shadow-[0_12px_26px_-22px_rgba(238,77,45,0.72)]"
                : "border-outline-variant bg-surface-container-low hover:border-primary/35 hover:bg-surface",
            )}
          >
            <input
              checked={paymentMethod === option.value}
              className="mr-2"
              name="payment-method"
              type="radio"
              value={option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="font-medium text-on-surface">{option.label}</span>
            <span className="mt-2 block text-on-surface-variant">{option.note}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
