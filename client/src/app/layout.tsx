import type { Metadata } from "next";
import { Inter, Noto_Serif } from "next/font/google";

import { StorefrontProvider } from "@/store/storefront-provider";

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
    default: "ND Shop",
    template: "%s | ND Shop",
  },
  description:
    "Editorial storefront demo for the ND Shop commerce platform, rebuilt from the referenced Stitch design with production-ready Next.js structure.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} ${notoSerif.variable}`}>
      <body>
        <StorefrontProvider>{children}</StorefrontProvider>
      </body>
    </html>
  );
}
