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
}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
    size === "sm" && "px-3 py-2 text-xs font-semibold tracking-[0.2em] uppercase",
    size === "md" && "px-5 py-2.5 text-sm font-medium",
    size === "lg" && "px-8 py-4 text-sm font-medium",
    variant === "primary" &&
      "bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-editorial hover:-translate-y-0.5 hover:shadow-[0_28px_48px_-18px_rgba(27,28,25,0.16)] active:scale-[0.98]",
    variant === "secondary" &&
      "border border-outline-variant/50 bg-white/45 text-primary hover:border-primary/35 hover:bg-surface-container-highest/80",
    variant === "tertiary" &&
      "px-0 text-primary underline decoration-transparent underline-offset-8 hover:decoration-tertiary",
    variant === "ghost" &&
      "bg-surface-container-low text-primary hover:bg-surface-container-high",
    className,
  );
}
