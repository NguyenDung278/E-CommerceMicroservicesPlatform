import { formatCurrency } from "../utils/format";

type PriceLabelProps = {
  value: number;
  size?: "small" | "normal" | "large";
};

export function PriceLabel({ value, size = "normal" }: PriceLabelProps) {
  return <span className={`price-label price-label--${size}`}>{formatCurrency(value)}</span>;
}
