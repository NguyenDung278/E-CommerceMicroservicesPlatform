import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-outline-variant/20 bg-surface-container-low">
      <div className="shell grid gap-10 py-12 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <p className="font-serif text-2xl font-semibold tracking-[-0.03em] text-primary">
            Commerce Platform
          </p>
          <p className="mt-4 max-w-md text-sm leading-7 text-on-surface-variant">
            Storefront thương mại điện tử được nối trực tiếp với product-service, user-service, order-service và payment-service của repo hiện tại.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-tertiary">Mua sắm</p>
          <div className="mt-4 space-y-3 text-sm text-on-surface-variant">
            <Link href="/products" className="block hover:text-primary">
              Catalog
            </Link>
            <Link href="/cart" className="block hover:text-primary">
              Giỏ hàng
            </Link>
            <Link href="/checkout" className="block hover:text-primary">
              Checkout
            </Link>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-tertiary">Tài khoản</p>
          <div className="mt-4 space-y-3 text-sm text-on-surface-variant">
            <Link href="/profile" className="block hover:text-primary">
              Hồ sơ
            </Link>
            <Link href="/myorders" className="block hover:text-primary">
              Đơn hàng
            </Link>
            <Link href="/payments" className="block hover:text-primary">
              Thanh toán
            </Link>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-tertiary">Hệ thống</p>
          <div className="mt-4 space-y-3 text-sm text-on-surface-variant">
            <a className="block hover:text-primary" href="/health" target="_blank" rel="noreferrer">
              Health
            </a>
            <a className="block hover:text-primary" href="/api/v1/products?limit=1" target="_blank" rel="noreferrer">
              Products API
            </a>
            <Link href="/security" className="block hover:text-primary">
              Security
            </Link>
            <Link href="/addresses" className="block hover:text-primary">
              Addresses
            </Link>
            <Link href="/notifications" className="block hover:text-primary">
              Notifications
            </Link>
            <Link href="/payments" className="block hover:text-primary">
              Payments
            </Link>
            <Link href="/myorders" className="block hover:text-primary">
              Orders
            </Link>
            <Link href="/profile" className="block hover:text-primary">
              Tài khoản
            </Link>
            <a className="block hover:text-primary" href="/api/v1/orders" target="_blank" rel="noreferrer">
              Orders API
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
