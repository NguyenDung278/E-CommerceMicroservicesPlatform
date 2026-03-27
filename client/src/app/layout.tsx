import type { Metadata } from "next";
import { Inter, Noto_Serif } from "next/font/google";

import { AppProviders } from "@/providers/app-providers";

import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Commerce Platform",
    template: "%s | Commerce Platform",
  },
  description:
    "Storefront thương mại điện tử kết nối trực tiếp với backend Go microservices hiện có trong repo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} ${notoSerif.variable}`}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
