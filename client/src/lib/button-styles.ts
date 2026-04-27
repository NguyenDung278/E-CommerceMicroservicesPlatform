import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-lg)] transition duration-200 disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
    size === "sm" && "min-h-9 px-3 py-2 text-xs font-semibold",
    size === "md" && "min-h-10 px-4 py-2.5 text-sm font-medium",
    size === "lg" && "min-h-12 px-6 py-3 text-sm font-semibold",
    variant === "primary" &&
      "bg-primary text-on-primary shadow-[0_14px_28px_-18px_rgba(238,77,45,0.9)] hover:bg-primary-container hover:shadow-[0_18px_34px_-20px_rgba(238,77,45,0.95)] active:scale-[0.98]",
    variant === "secondary" &&
      "border border-outline-variant bg-surface text-on-surface shadow-[0_8px_20px_-18px_rgba(17,24,39,0.46)] hover:border-primary/35 hover:bg-surface-container-low hover:text-primary",
    variant === "tertiary" &&
      "px-0 text-primary underline decoration-transparent underline-offset-8 hover:decoration-primary",
    variant === "ghost" &&
      "bg-surface-container-low text-on-surface hover:bg-surface-container hover:text-primary",
    className,
  );
}
