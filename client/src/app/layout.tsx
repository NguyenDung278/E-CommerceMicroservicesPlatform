import type { Metadata } from "next";

import { AppProviders } from "@/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ND Shop",
    template: "%s | ND Shop",
  },
  description:
    "ND Shop là storefront thương mại điện tử để người dùng đăng ký, mua sản phẩm, thanh toán và theo dõi đơn hàng trên backend microservices hiện tại.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
