"use client";

import type { Address } from "@/types/api";

import { type CheckoutFormState } from "@/components/storefront/checkout/checkout-shared";

export function CheckoutRecipientSection({
  addresses,
  form,
  isLoadingAddresses,
  onSelectAddress,
  onChange,
}: {
  addresses: Address[];
  form: CheckoutFormState;
  isLoadingAddresses: boolean;
  onSelectAddress: (address: Address) => void;
  onChange: (field: keyof CheckoutFormState, value: string) => void;
}) {
  return (
    <section className="commerce-section">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Người nhận</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Chỉ giữ các trường bắt buộc để hoàn tất giao hàng.
          </p>
        </div>
        {isLoadingAddresses ? <span className="text-sm text-on-surface-variant">Đang tải địa chỉ...</span> : null}
      </div>

      {addresses.length > 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {addresses.map((address) => (
            <button
              key={address.id}
              type="button"
              className="rounded-[var(--radius-lg)] border border-outline-variant bg-surface-container-low p-3 text-left text-sm transition hover:border-primary/40 hover:bg-surface"
              onClick={() => onSelectAddress(address)}
            >
              <strong className="text-on-surface">{address.recipient_name}</strong>
              <span className="mt-1 block text-on-surface-variant">{address.location}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-on-surface">
          Họ tên
          <input
            className="commerce-input"
            value={form.fullName}
            onChange={(event) => onChange("fullName", event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-on-surface">
          Số điện thoại
          <input
            className="commerce-input"
            value={form.phone}
            onChange={(event) => onChange("phone", event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-on-surface md:col-span-2">
          Địa chỉ
          <input
            className="commerce-input"
            value={form.location}
            onChange={(event) => onChange("location", event.target.value)}
          />
        </label>
      </div>
    </section>
  );
}
