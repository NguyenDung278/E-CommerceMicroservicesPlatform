import type { Metadata } from "next";

import { AppProviders } from "@/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ND Shop",
    template: "%s | ND Shop",
  },
  description:
    "ND Shop tập trung vào sản phẩm, danh mục, giỏ hàng và thanh toán trong một trải nghiệm mua sắm tối giản.",
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
