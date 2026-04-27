"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

import type { CheckoutShippingOption, ShippingChoice } from "@/components/storefront/checkout/checkout-shared";

export function CheckoutShippingSection({
  shippingOptions,
  shippingMethod,
  onChange,
}: {
  shippingOptions: CheckoutShippingOption[];
  shippingMethod: ShippingChoice;
  onChange: (value: ShippingChoice) => void;
}) {
  return (
    <section className="commerce-section">
      <h2 className="text-lg font-semibold text-on-surface">Giao hàng</h2>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {shippingOptions.map((option) => (
          <label
            key={option.value}
            className={cn(
              "rounded-[var(--radius-lg)] border p-4 text-sm transition",
              shippingMethod === option.value
                ? "border-primary bg-[#fff4f1] shadow-[0_12px_26px_-22px_rgba(238,77,45,0.72)]"
                : "border-outline-variant bg-surface-container-low hover:border-primary/35 hover:bg-surface",
            )}
          >
            <input
              checked={shippingMethod === option.value}
              className="mr-2"
              name="shipping-method"
              type="radio"
              value={option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="font-medium text-on-surface">{option.label}</span>
            <span className="mt-2 block text-on-surface-variant">
              {option.fee === 0 ? "Miễn phí" : formatCurrency(option.fee)}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
