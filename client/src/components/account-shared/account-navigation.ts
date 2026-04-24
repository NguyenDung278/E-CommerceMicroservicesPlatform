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
  { href: "/profile", label: "Thông tin cá nhân", icon: UserRound },
  { href: "/myorders", label: "Đơn hàng của tôi", icon: Package },
  { href: "/returns", label: "Đổi trả", icon: RotateCcw },
  { href: "/addresses", label: "Địa chỉ", icon: MapPin },
  { href: "/payments", label: "Thanh toán", icon: CreditCard },
  { href: "/security", label: "Bảo mật", icon: ShieldCheck },
  { href: "/notifications", label: "Thông báo", icon: Bell },
] as const;
