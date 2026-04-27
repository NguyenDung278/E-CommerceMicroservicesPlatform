type QuantityControlProps = {
  value: number;
  onChange: (value: number) => void;
};

export function QuantityControl({ value, onChange }: QuantityControlProps) {
  return (
    <div className="quantity-control">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))}>
        -
      </button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
