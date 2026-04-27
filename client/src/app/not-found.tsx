import Link from "next/link";

import {
  RecoveredEditorialFooter,
  RecoveredStorefrontHeader,
} from "@/components/storefront-shared/recovered-storefront-chrome";
import { buttonStyles } from "@/lib/button-styles";

export default function NotFound() {
  return (
    <main>
      <section className="shell pt-6 md:pt-8">
        <RecoveredStorefrontHeader navigation="fallback" tone="light" />
      </section>
      <section className="shell flex min-h-[70svh] items-center justify-center py-16">
        <div className="max-w-3xl rounded-[2rem] border border-[#d9d2c9] bg-white/72 px-8 py-14 text-center shadow-editorial backdrop-blur">
          <p className="eyebrow">404</p>
          <h1 className="mt-4 font-serif text-5xl font-semibold tracking-[-0.04em] text-primary">
            Không tìm thấy trang bạn đang mở
          </h1>
          <p className="mt-5 text-base leading-8 text-on-surface-variant">
            Trang này hiện không còn khả dụng. Bạn có thể quay về trang chủ
            hoặc tiếp tục khám phá sản phẩm đang mở bán.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/" className={buttonStyles({ size: "lg" })}>
              Về trang chủ
            </Link>
            <Link
              href="/products"
              className={buttonStyles({ variant: "secondary", size: "lg" })}
            >
              Mở sản phẩm
            </Link>
          </div>
        </div>
      </section>
      <section className="shell pb-12">
        <RecoveredEditorialFooter />
      </section>
    </main>
  );
}
