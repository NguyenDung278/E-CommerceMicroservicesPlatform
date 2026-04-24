import type { Metadata } from "next";

import { AppProviders } from "@/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ND Shop",
    template: "%s | ND Shop",
  },
  description:
    "ND Shop là nơi để khám phá sản phẩm, lưu món yêu thích, thanh toán và theo dõi đơn hàng trong một trải nghiệm mua sắm gọn gàng.",
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
