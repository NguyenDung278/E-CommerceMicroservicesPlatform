import type { Address, Product, ShippingAddress } from "@/types/api";

import { resolveStorefrontProductImage } from "@/components/storefront/storefront-shared";

export type PaymentChoice = "manual" | "momo";
export type ShippingChoice = "standard" | "express" | "pickup";

export type CheckoutFormState = {
  fullName: string;
  location: string;
  phone: string;
};

export type DraftItem = {
  product_id: string;
  quantity: number;
  name: string;
  price: number;
  stock: number;
  status: string;
  imageUrl: string;
};

export type CheckoutPaymentOption = {
  value: PaymentChoice;
  label: string;
  note: string;
};

export type CheckoutShippingOption = {
  value: ShippingChoice;
  label: string;
  fee: number;
};

export const emptyCheckoutForm: CheckoutFormState = {
  fullName: "",
  location: "",
  phone: "",
};

export const checkoutPaymentOptions: CheckoutPaymentOption[] = [
  { value: "manual", label: "Thanh toán nhanh", note: "Xác nhận tức thì trong hệ thống." },
  { value: "momo", label: "MoMo", note: "Chuyển sang cổng thanh toán MoMo." },
];

export function mapAddressToCheckoutForm(address: Address): CheckoutFormState {
  return {
    fullName: address.recipient_name,
    location: address.location,
    phone: address.phone,
  };
}

export function buildCheckoutShippingAddress(form: CheckoutFormState): ShippingAddress {
  return {
    recipient_name: form.fullName.trim(),
    phone: form.phone.trim(),
    location: form.location.trim(),
  };
}

export function buildCheckoutShippingOptions(subtotal: number): CheckoutShippingOption[] {
  return [
    { value: "standard", label: "Giao tiêu chuẩn", fee: subtotal > 120 ? 0 : 8 },
    { value: "express", label: "Giao nhanh", fee: 12 },
    { value: "pickup", label: "Nhận tại quầy", fee: 0 },
  ];
}

export function buildCheckoutProductImage(product: Product | null, fallbackName: string) {
  return resolveStorefrontProductImage(product, fallbackName);
}
