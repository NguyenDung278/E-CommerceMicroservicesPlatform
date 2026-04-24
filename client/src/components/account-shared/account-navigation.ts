import {
  Bell,
  CreditCard,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export const accountNavigationItems = [
  { href: "/profile", label: "Personal Info", icon: UserRound },
  { href: "/myorders", label: "My Orders", icon: Package },
  { href: "/returns", label: "Returns", icon: RotateCcw },
  { href: "/addresses", label: "Addresses", icon: MapPin },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/notifications", label: "Notifications", icon: Bell },
] as const;
