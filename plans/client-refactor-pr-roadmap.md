# Kế hoạch triển khai backlog refactor và tối ưu `client/`

## 1. Mục tiêu tài liệu

Tài liệu này chuyển backlog refactor hiện tại thành một kế hoạch triển khai thực chiến theo từng PR nhỏ, có thể:

- review độc lập
- test độc lập
- rollback độc lập
- phát hành độc lập

Thứ tự triển khai được chốt như sau:

1. `PR-01` Route-level initial data
2. `PR-02` Provider stabilization
3. `PR-03` Cart/account resource dedupe
4. `PR-06` Image pipeline cleanup
5. `PR-04` Catalog query contract cleanup
6. `PR-05` Backend additive endpoints
7. `PR-07` Shared contract/import boundary
8. `PR-08` Stitch reduction + runtime/docs alignment

Tài liệu này đào sâu 3 PR đầu tiên vì đây là các quick win an toàn nhất ở phía `client`, có tỷ lệ tác động/rủi ro tốt nhất và là nền để các PR sau bám vào.

## 2. Phạm vi và giả định

### 2.1. Phạm vi chính

- Ứng dụng Next.js tại [`client/`](/Users/nguyendung/FPT/projects/ecommerce-platform/client)
- Chỉ chạm backend nếu thật sự cần cho `PR-03` trở đi
- Không rework lại các hotspot đã refactor tốt trước đó trừ khi cần follow-through hoặc đồng bộ kiến trúc

### 2.2. Giả định làm việc

- `client/` là nhánh UI đang được ưu tiên tối ưu về maintainability và performance, dù chưa phải default runtime trong Docker Compose.
- Các API HTTP hiện tại vẫn là nguồn dữ liệu chính cho `client`, đặc biệt:
  - [`services/product-service/internal/handler/product_handler.go`](/Users/nguyendung/FPT/projects/ecommerce-platform/services/product-service/internal/handler/product_handler.go)
  - [`services/order-service/internal/handler/order_handler.go`](/Users/nguyendung/FPT/projects/ecommerce-platform/services/order-service/internal/handler/order_handler.go)
  - [`services/payment-service/internal/handler/payment_handler.go`](/Users/nguyendung/FPT/projects/ecommerce-platform/services/payment-service/internal/handler/payment_handler.go)
- Ở vòng đầu, không đưa thêm state library mới như React Query, Zustand, Redux hoặc framework data cache mới.
- Mục tiêu của 3 PR đầu là:
  - không đổi nghiệp vụ
  - không đổi shape API
  - không tạo migration backend
  - giảm re-render và request thừa

### 2.3. Các file hiện là điểm nóng chính

- Route shell App Router:
  - [`client/src/app/page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/app/page.tsx)
  - [`client/src/app/products/page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/app/products/page.tsx)
  - [`client/src/app/products/[productId]/page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/app/products/[productId]/page.tsx)
- Commerce screens:
  - [`client/src/components/home-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/home-page.tsx)
  - [`client/src/components/catalog-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/catalog-page.tsx)
  - [`client/src/components/product-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/product-page.tsx)
  - [`client/src/components/product-page/use-product-page-state.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/product-page/use-product-page-state.ts)
  - [`client/src/components/cart-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/cart-page.tsx)
- Providers:
  - [`client/src/providers/auth-provider.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/providers/auth-provider.tsx)
  - [`client/src/providers/cart-provider.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/providers/cart-provider.tsx)
  - [`client/src/providers/wishlist-provider.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/providers/wishlist-provider.tsx)
  - [`client/src/components/site-header.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/site-header.tsx)
- Hooks/resource read:
  - [`client/src/hooks/useOrderPayments.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/hooks/useOrderPayments.ts)
  - [`client/src/hooks/useSavedAddresses.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/hooks/useSavedAddresses.ts)
  - [`client/src/lib/api/http-client.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/lib/api/http-client.ts)

## 3. Bức tranh ưu tiên tổng thể

| Thứ tự | PR | Mức ưu tiên | Mục tiêu chính | Phụ thuộc |
| --- | --- | --- | --- | --- |
| 1 | `PR-01` | Cao | Dời initial data về route/server entry để giảm waterfall | Không |
| 2 | `PR-02` | Cao | Ổn định provider, giảm global re-render | Không bắt buộc, nhưng nên sau `PR-01` |
| 3 | `PR-03` | Cao | Dedupe resource read ở cart/account | Không bắt buộc, nhưng tốt nhất sau `PR-02` |
| 4 | `PR-06` | Trung bình | Làm sạch pipeline ảnh và host policy | Không |
| 5 | `PR-04` | Trung bình | Làm sạch query contract của catalog | Nên sau `PR-01` |
| 6 | `PR-05` | Trung bình | Bổ sung endpoint additive để thay thế dedupe tạm | Nên sau `PR-03` |
| 7 | `PR-07` | Trung bình | Chuẩn hóa contract/import boundary | Nên sau các quick win |
| 8 | `PR-08` | Thấp hơn, rủi ro cao hơn | Tách Stitch + đồng bộ runtime/docs | Nên làm cuối |

## 4. Kế hoạch triển khai chi tiết cho 3 PR đầu

---

## PR-01: Route-Level Initial Data

### 4.1. Bối cảnh

`client/` đang dùng Next.js App Router nhưng phần lớn route mới chỉ đóng vai trò route shell, rồi render các client component lớn tự fetch dữ liệu bằng `useEffect`.

Ví dụ:

- [`client/src/app/page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/app/page.tsx) chỉ trả `<HomePage />`
- [`client/src/app/products/page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/app/products/page.tsx) chỉ trả `<CatalogPage />`
- [`client/src/app/products/[productId]/page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/app/products/[productId]/page.tsx) chỉ truyền `productId` xuống `<ProductPage />`

Trong khi đó:

- [`client/src/components/home-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/home-page.tsx) fetch sản phẩm và popularity sau mount
- [`client/src/components/catalog-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/catalog-page.tsx) fetch catalog index và product list sau mount
- [`client/src/components/product-page/use-product-page-state.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/product-page/use-product-page-state.ts) fetch product, review list, my review sau mount

Điều này làm App Router chưa phát huy tác dụng cho:

- first paint
- initial HTML stability
- network waterfall
- perceived loading

### 4.2. Mục tiêu

- Đưa dữ liệu ban đầu của các route thương mại điện tử chính về route-level/server entry.
- Giữ các phần tương tác sau initial render ở client.
- Không đổi hành vi nghiệp vụ và không đổi shape API HTTP hiện tại.

### 4.3. Vấn đề hiện tại

#### Vấn đề 1: Waterfall ở initial render

Trang phải:

1. tải bundle client
2. mount component
3. chạy `useEffect`
4. mới bắt đầu gọi API

Đây là nguyên nhân chính làm homepage, catalog và product detail có cảm giác chậm hoặc “blank quá lâu”.

#### Vấn đề 2: App Router bị dùng như route registry, không phải data boundary

Trách nhiệm giữa route và component đang chưa rõ:

- route chỉ pass-through
- component làm cả fetch, orchestration, render

#### Vấn đề 3: Khó tối ưu loading state

Vì data không có sẵn từ route, các component phải tự dựng `isLoading`, `empty state`, `error state`, dễ dẫn tới duplication và jank.

### 4.4. Nguyên nhân kỹ thuật

- Chưa có lớp server fetch helper riêng cho `client`
- Chưa define rõ ranh giới:
  - route chịu trách nhiệm initial data
  - component chịu trách nhiệm interaction và client updates
- Refactor trước đã tách UI tốt ở một số nơi, nhưng chưa follow-through đến route layer

### 4.5. Kiến trúc đề xuất

#### Nguyên tắc

- Route App Router lấy initial data ở server side
- Client component nhận `initialData`
- Hook/client logic chỉ refetch khi:
  - có thao tác người dùng
  - query/filter thay đổi
  - cần dữ liệu auth-specific

#### Mô hình đề xuất

```text
app route
  -> server fetch helper
  -> initialData
  -> client page component
       -> interactive state
       -> optional client refresh/refetch
```

#### Phân tách trách nhiệm

- `app/*.tsx`: resolve params, gọi server fetch helper, pass props
- `lib/server/*` hoặc `features/*/server/*`: đọc dữ liệu ban đầu
- `components/*.tsx`: render UI từ initial data
- `hooks/*`: chỉ xử lý behavior tương tác sau initial render

### 4.6. Phạm vi thay đổi

#### Frontend

- [`client/src/app/page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/app/page.tsx)
- [`client/src/app/products/page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/app/products/page.tsx)
- [`client/src/app/products/[productId]/page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/app/products/[productId]/page.tsx)
- [`client/src/components/home-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/home-page.tsx)
- [`client/src/components/catalog-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/catalog-page.tsx)
- [`client/src/components/product-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/product-page.tsx)
- [`client/src/components/product-page/use-product-page-state.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/product-page/use-product-page-state.ts)

#### Backend

- Không bắt buộc ở PR này

### 4.7. Dependency với các PR khác

- Không phụ thuộc bắt buộc vào `PR-02` và `PR-03`
- Nên làm trước `PR-04` vì catalog data flow cần ổn trước khi đổi query contract

### 4.8. Các file/module dự kiến thêm mới

Giả định hợp lý:

- [`client/src/lib/server/home.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/lib/server/home.ts)
- [`client/src/lib/server/catalog.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/lib/server/catalog.ts)
- [`client/src/lib/server/product.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/lib/server/product.ts)

Nếu team muốn bám theo domain thay vì `lib/server`, có thể dùng:

- `client/src/features/home/server/*`
- `client/src/features/catalog/server/*`
- `client/src/features/product/server/*`

Ở vòng đầu, chọn `lib/server` là ít churn nhất.

### 4.9. Trình tự implement chi tiết

#### Bước 1: Tạo server fetch helper dùng được ở route

Tạo helper thuần async, trả về dữ liệu đã normalize.

Ví dụ pseudocode:

```ts
// client/src/lib/server/home.ts
import { productApi } from "@/lib/api/product";

export async function getHomePageInitialData() {
  const [productsResponse, popularityResponse] = await Promise.all([
    productApi.listProducts({ status: "active", limit: 12 }),
    productApi.getProductPopularity(8).catch(() => ({ data: [] })),
  ]);

  return {
    products: productsResponse.data,
    popularity: popularityResponse.data,
  };
}
```

Lưu ý:

- nếu `productApi` hiện phụ thuộc `fetch` client-only behavior hoặc `document`, cần giữ helper server-safe
- nếu cần, tạo `requestServer()` riêng thay vì tái dùng toàn bộ client API layer

#### Bước 2: Route truyền `initialData` vào page component

Ví dụ sample diff:

```tsx
// before
export default function Page() {
  return <HomePage />;
}

// after
import { getHomePageInitialData } from "@/lib/server/home";
import { HomePage } from "@/components/home-page";

export default async function Page() {
  const initialData = await getHomePageInitialData();
  return <HomePage initialData={initialData} />;
}
```

#### Bước 3: `HomePage` nhận initial data, bỏ initial `useEffect`

Hướng xử lý:

- khởi tạo state từ `initialData`
- chỉ fetch lại nếu có user-driven refresh hoặc nhu cầu thật sự

Pseudocode:

```tsx
type HomePageProps = {
  initialData: {
    products: Product[];
    popularity: ProductPopularity[];
  };
};

export function HomePage({ initialData }: HomePageProps) {
  const [state, setState] = useState({
    products: initialData.products,
    popularity: initialData.popularity,
    isLoading: false,
    error: "",
  });
}
```

#### Bước 4: `CatalogPage` nhận initial listing tối thiểu

Ở PR đầu, không cố SSR toàn bộ combinations filter/search phức tạp.

Phạm vi an toàn:

- server-prefetch landing state cơ bản
- `initialCategory` nếu có từ route categories
- client vẫn làm refresh khi query params đổi

Mục tiêu là tránh blank state ban đầu, không cần hoàn thành catalog architecture đầy đủ ở PR này.

#### Bước 5: `ProductPage` nhận `initialProduct`

Ở vòng đầu:

- server-prefetch `product`
- có thể giữ `review list`, `my review`, `related products` ở client nếu muốn giảm rủi ro

Hoặc nếu team thấy ổn, prefetch luôn `review list` public.

#### Bước 6: Sửa `useProductPageState`

Hook cần hỗ trợ:

- nhận `initialProduct`
- skip fetch product nếu data đã có
- chỉ fetch auth-specific `myReview` khi có token

Pseudo-API:

```ts
export function useProductPageState(productId: string, initialProduct?: Product | null) {
  const [product, setProduct] = useState<Product | null>(initialProduct ?? null);
}
```

#### Bước 7: Dọn loading state không còn cần thiết

Ví dụ:

- `HomePage` không nên luôn vào skeleton nếu đã có initial data
- `ProductPage` không nên full-screen loading nếu `product` đã có sẵn

### 4.10. Các điểm refactor cần lưu ý

- Không trộn logic server fetch vào file component client
- Không duplicate normalization logic ở nhiều nơi
- Nếu `productApi` đang gắn chặt vào `request()` client-side, cần cân nhắc lớp server fetch helper gọi trực tiếp `fetch`
- Ưu tiên additive props thay vì thay signature lớn của nhiều component cùng lúc

### 4.11. Rủi ro

- hydration mismatch
- duplicate fetch nếu initial data và client fetch cùng chạy
- catalog state bị lệch khi query params thay đổi nhanh

### 4.12. Phương án rollback

- route bỏ `initialData`
- component quay về `useEffect` cũ
- không có migration dữ liệu nên rollback đơn giản

### 4.13. Test plan

#### Build

- `cd client && npm run build`

#### Smoke flow

- `/` hiển thị hero, category, product list ngay khi mở
- `/products` có initial listing ngay cả trước tương tác filter
- `/products/[productId]` hiển thị được product detail, add to cart vẫn hoạt động

#### Kiểm tra bằng DevTools

- Network waterfall trước/sau
- React hydration warnings trên console

#### Kiểm tra bằng Lighthouse

- mobile report cho:
  - `/`
  - `/products`
  - `/products/[id]`

### 4.14. Edge cases

- API lỗi ở server entry
- `productId` không tồn tại
- `initialCategory` có ký tự encode/decode đặc biệt
- user mở product detail rồi đăng nhập, `myReview` phải vẫn fetch đúng sau đó

### 4.15. Acceptance criteria

- Route homepage, catalog, product detail đều có `initialData` hoặc `initialProduct` ở route level
- Không có fetch thừa cho product ban đầu trên PDP khi đã có initial data
- Không đổi behavior cart/wishlist/reviews
- `npm run build` pass
- Không có hydration warning mới

---

## PR-02: Provider Stabilization

### 5.1. Bối cảnh

`client` đang bọc app bằng:

- [`client/src/providers/auth-provider.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/providers/auth-provider.tsx)
- [`client/src/providers/cart-provider.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/providers/cart-provider.tsx)
- [`client/src/providers/wishlist-provider.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/providers/wishlist-provider.tsx)

Trong đó:

- `wishlist` đã có `useMemo`
- `auth` và `cart` chưa ổn định `value` object
- [`client/src/components/site-header.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/site-header.tsx) subscribe cả `auth`, `cart`, `wishlist`

Điều này khiến các thay đổi state cục bộ có thể phát sinh rerender rộng hơn cần thiết.

### 5.2. Mục tiêu

- Giảm rerender không cần thiết từ `AuthProvider` và `CartProvider`
- Làm rõ ranh giới giữa state và actions
- Giữ nguyên public behavior của `useAuth()` và `useCart()` nếu có thể

### 5.3. Vấn đề hiện tại

#### Vấn đề 1: Context value được tạo inline mỗi lần render

Ví dụ ở `auth-provider`:

```tsx
<AuthContext.Provider value={{ token, refreshToken, user, isAuthenticated, ... }}>
```

Ví dụ ở `cart-provider`:

```tsx
<CartContext.Provider value={{ cart, itemCount, isLoading, error, refreshCart, ... }}>
```

Mỗi lần provider render, object `value` mới được tạo ra, làm các consumer re-render dù phần chúng dùng có thể không đổi.

#### Vấn đề 2: State và actions bị gộp chung

Consumer chỉ cần:

- `itemCount`
- `isAuthenticated`

vẫn bị subscribe chung với:

- `updateProfile`
- `sendPhoneOtp`
- `addItem`
- `removeItem`

#### Vấn đề 3: Global components bị ảnh hưởng

[`SiteHeader`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/site-header.tsx) là component xuất hiện ở hầu hết route, nên bất kỳ rerender thừa nào ở đây đều tác động lớn tới trải nghiệm.

### 5.4. Nguyên nhân kỹ thuật

- Chưa memoize provider value
- Chưa tách state context và action context
- Chưa audit consumer để giảm subscription surface

### 5.5. Kiến trúc đề xuất

#### Giai đoạn an toàn nhất

Ở PR này không cần tách hẳn nhiều context ngay từ đầu. Triển khai theo 2 lớp:

1. `useMemo` cho provider value
2. Nếu cần, tách `state` và `actions` nhưng vẫn giữ compatibility hook

#### Mô hình đề xuất

```text
AuthProvider
  -> AuthStateContext
  -> AuthActionsContext

CartProvider
  -> CartStateContext
  -> CartActionsContext
```

Nhưng để giảm rủi ro, có thể dùng:

- `AuthContext` cũ nhưng memoized ở vòng đầu
- `CartContext` cũ nhưng memoized ở vòng đầu

Rồi mới tách context nếu Profiler cho thấy vẫn còn nóng.

### 5.6. Phạm vi thay đổi

- [`client/src/providers/auth-provider.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/providers/auth-provider.tsx)
- [`client/src/providers/cart-provider.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/providers/cart-provider.tsx)
- [`client/src/providers/app-providers.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/providers/app-providers.tsx)
- [`client/src/components/site-header.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/site-header.tsx)
- Có thể thêm:
  - `client/src/hooks/useAuthState.ts`
  - `client/src/hooks/useAuthActions.ts`
  - `client/src/hooks/useCartState.ts`
  - `client/src/hooks/useCartActions.ts`

### 5.7. Dependency với các PR khác

- Không phụ thuộc bắt buộc vào `PR-01`
- Nên làm sau `PR-01` để tránh trộn cả data-loading refactor và provider refactor trong cùng thời điểm
- `PR-03` sẽ hưởng lợi trực tiếp từ provider đã ổn định

### 5.8. Trình tự implement chi tiết

#### Bước 1: Memoize `AuthProvider` value

Pseudo-diff:

```tsx
const value = useMemo(
  () => ({
    token,
    refreshToken,
    user,
    isAuthenticated: Boolean(token || refreshToken),
    isAdmin,
    isStaff,
    canAccessAdmin,
    isBootstrapping,
    error,
    register,
    login,
    beginOAuthLogin,
    exchangeOAuthTicket,
    logout,
    refreshProfile,
    updateProfile,
    getPhoneVerificationStatus,
    sendPhoneOtp,
    verifyPhoneOtp,
    resendPhoneOtp,
    changePassword,
    resendVerificationEmail,
    clearError,
  }),
  [...]
);
```

Lưu ý:

- `clearError` nên là callback ổn định, không nên inline `() => setError("")`

#### Bước 2: Memoize `CartProvider` value

Tách `itemCount` thành derived state memoized:

```tsx
const itemCount = useMemo(
  () => cart.items.reduce((sum, item) => sum + item.quantity, 0),
  [cart.items],
);
```

Rồi memoize toàn bộ `value`.

#### Bước 3: Audit consumer nóng nhất là `SiteHeader`

Kiểm tra `SiteHeader` chỉ đọc:

- `isAuthenticated`
- `itemCount`
- `wishlistCount`

Không kéo thêm state khác không cần.

#### Bước 4: Nếu cần, tách `state`/`actions`

Chỉ làm nếu sau `useMemo` mà Profiler vẫn cho thấy rerender nóng đáng kể.

Tách theo cách compatibility-friendly:

- `useAuth()` và `useCart()` vẫn trả shape cũ
- nội bộ lấy từ 2 context khác nhau

#### Bước 5: Thêm comment ngắn giải thích vì sao value cần ổn định

Comment có giá trị nên đặt ở chỗ như:

- `SiteHeader` là global consumer
- auth/cart updates dễ broadcast rộng

### 5.9. Các điểm refactor cần lưu ý

- Không đổi semantics của `isAuthenticated`
- Không đổi thứ tự bootstrap session
- Không làm stale callback ở auth flow
- Không làm cart badge cập nhật chậm hoặc sai

### 5.10. Rủi ro

- Quên dependency trong `useMemo` hoặc `useCallback`
- `clearError` hoặc một action khác bị stale closure
- Hook compatibility bị lệch nếu tách context quá nhanh

### 5.11. Phương án rollback

- Rollback đơn giản về provider cũ
- Không có data migration
- Không có contract change

### 5.12. Test plan

#### React Profiler

Đo các flow:

- add to cart
- login/logout
- OTP timer/profile refresh nếu có

So sánh:

- số lần rerender của `SiteHeader`
- commit duration

#### Smoke test

- đăng nhập
- đăng xuất
- thêm sản phẩm vào giỏ
- cập nhật số lượng giỏ
- badge cart hiển thị đúng

#### Build

- `cd client && npm run build`

### 5.13. Edge cases

- bootstrapping session khi có refresh token nhưng chưa có user
- logout ngay trong lúc bootstrap
- add/remove item liên tiếp
- OTP countdown update mỗi giây không được làm layout header giật

### 5.14. Acceptance criteria

- `AuthProvider` và `CartProvider` không còn tạo `value` inline không ổn định
- `SiteHeader` giảm rerender trong flow add to cart và auth transitions
- Không đổi behavior của hooks công khai
- `npm run build` pass

---

## PR-03: Cart/Account Resource Dedupe

### 6.1. Bối cảnh

Hiện tại `client` có nhiều fetch read-path bị lặp hoặc N+1:

- [`client/src/components/cart-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/cart-page.tsx) fetch `getProductById` cho từng cart item
- `wishlist` preview trong cart cũng fetch từng product
- [`client/src/hooks/useOrderPayments.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/hooks/useOrderPayments.ts) gọi:
  - `orderApi.listOrders(token)`
  - `paymentApi.listPaymentHistory(token)`
- [`client/src/hooks/useSavedAddresses.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/hooks/useSavedAddresses.ts) fetch mỗi nơi dùng

Ở giai đoạn này, đây là read-path duplication rõ ràng, có thể xử lý trước bằng resource dedupe nhẹ phía client.

### 6.2. Mục tiêu

- Giảm request trùng lặp và N+1 ở cart/account
- Chưa thêm endpoint backend mới ở PR này
- Chưa thêm state library mới
- Tạo một resource layer mỏng, dễ hiểu, có TTL và invalidate tối thiểu

### 6.3. Vấn đề hiện tại

#### Vấn đề 1: `CartPage` tạo nhiều request product detail

Khi cart có nhiều item, trang gọi `getProductById` cho từng item. Nếu user đi qua lại hoặc mutate nhẹ, số request tăng nhanh.

#### Vấn đề 2: Account pages fetch full data nhiều lần

`orders`, `payments`, `addresses` đang được đọc bởi các hook tách rời, chưa có lớp điều phối/dedupe chung.

#### Vấn đề 3: Không có read cache ngắn hạn

Mọi mount gần nhau đều có thể kích hoạt fetch lặp, dù dữ liệu read-only trong vài giây không đổi.

### 6.4. Nguyên nhân kỹ thuật

- API layer hiện là wrapper mỏng quanh `fetch`, chưa có request dedupe
- Hook resource hiện tự fetch và tự giữ state, không chia sẻ cache
- Chưa define policy invalidate sau mutation

### 6.5. Kiến trúc đề xuất

#### Nguyên tắc

- Chỉ dedupe/cached cho read request
- TTL ngắn
- Có invalidate rõ ràng sau mutation
- Không biến `http-client` thành framework phức tạp

#### Mô hình đề xuất

```text
resource cache
  key -> promise/data/timestamp

hooks/components
  -> readResource(key, loader, ttl)
  -> invalidateResource(key) khi mutation thành công
```

#### Cách đặt vị trí mã nguồn

Ưu tiên:

- `client/src/lib/resources/cache.ts`
- `client/src/lib/resources/keys.ts`
- `client/src/lib/resources/account.ts`
- `client/src/lib/resources/product.ts`

Không nên nhồi trực tiếp vào [`client/src/lib/api/http-client.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/lib/api/http-client.ts) ở PR đầu, vì:

- khó debug
- dễ ảnh hưởng toàn hệ thống
- tăng rủi ro behavior ẩn

### 6.6. Phạm vi thay đổi

#### Frontend

- [`client/src/components/cart-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/cart-page.tsx)
- [`client/src/hooks/useOrderPayments.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/hooks/useOrderPayments.ts)
- [`client/src/hooks/useSavedAddresses.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/hooks/useSavedAddresses.ts)
- Có thể thêm:
  - `client/src/lib/resources/cache.ts`
  - `client/src/lib/resources/product-resources.ts`
  - `client/src/lib/resources/account-resources.ts`

#### Backend

- Không bắt buộc ở PR này

### 6.7. Dependency với các PR khác

- Không phụ thuộc backend mới
- Hưởng lợi nếu `PR-02` đã ổn provider
- Là nền để `PR-05` thay resource tạm bằng endpoint additive tốt hơn

### 6.8. Trình tự implement chi tiết

#### Bước 1: Tạo cache resource tối thiểu

Pseudo-code:

```ts
type CacheEntry<T> = {
  data?: T;
  promise?: Promise<T>;
  timestamp: number;
};

const resourceCache = new Map<string, CacheEntry<unknown>>();

export async function readResource<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const now = Date.now();
  const cached = resourceCache.get(key) as CacheEntry<T> | undefined;

  if (cached?.data && now - cached.timestamp < ttlMs) {
    return cached.data;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = loader().then((data) => {
    resourceCache.set(key, { data, timestamp: Date.now() });
    return data;
  }).finally(() => {
    const current = resourceCache.get(key) as CacheEntry<T> | undefined;
    if (current?.promise) {
      resourceCache.set(key, {
        data: current.data,
        timestamp: current.timestamp,
      });
    }
  });

  resourceCache.set(key, { promise, timestamp: now });
  return promise;
}
```

Lưu ý: implementation thực tế nên tránh bug `finally` ghi đè dữ liệu sai. Mục tiêu pseudocode ở đây là mô tả cơ chế, không copy y nguyên.

#### Bước 2: Tạo key helpers rõ nghĩa

Ví dụ:

```ts
export const resourceKeys = {
  savedAddresses: (token: string) => `addresses:${token}`,
  orderPayments: (token: string) => `order-payments:${token}`,
  productSummary: (productId: string) => `product:${productId}`,
};
```

#### Bước 3: Áp dụng cho `useSavedAddresses`

Thay vì mỗi lần gọi `userApi.listAddresses(token)` trực tiếp, hook sẽ:

- đọc từ `readResource`
- chỉ fetch thật nếu hết TTL hoặc bị invalidate

TTL gợi ý: `10_000` đến `30_000 ms`

#### Bước 4: Áp dụng cho `useOrderPayments`

Hook này đang fetch full orders + full payment history.

Ở PR này:

- dedupe để cùng token không fetch lặp sát nhau
- giữ behavior hiện tại

#### Bước 5: Áp dụng cho `CartPage`

`CartPage` có thể tạo helper:

- `loadProductSummaries(productIds: string[])`
- mỗi `productId` đọc qua cache resource

Nếu cart render lại nhanh nhiều lần, request giống nhau không lặp lại vô ích.

#### Bước 6: Thêm invalidate sau mutation

Ví dụ:

- sau update địa chỉ/profile, invalidate resource `savedAddresses`
- sau cancel order hoặc payment action, invalidate `orderPayments`
- sau cart mutation lớn, có thể invalidate map product tạm nếu cần

#### Bước 7: Không cache errors quá lâu

Nên tránh giữ lỗi trong cache dài hạn. Có thể:

- không cache lỗi
- hoặc cache lỗi rất ngắn

### 6.9. Các điểm refactor cần lưu ý

- Không dùng token raw làm cache key nếu team không muốn giữ dữ liệu nhạy cảm trong key string. Có thể hash ngắn hoặc dùng `user.id` nếu sẵn có.
- Không đẩy toàn bộ resource dedupe xuống `http-client`.
- Không cache POST/PUT/DELETE.
- Không giữ TTL quá dài cho dữ liệu account.

### 6.10. Rủi ro

- stale data sau mutation
- invalidate thiếu
- cache leak nếu key strategy không rõ hoặc không cleanup

### 6.11. Phương án rollback

- bỏ readResource ở các hook/page
- quay về gọi API trực tiếp
- không ảnh hưởng schema hay data

### 6.12. Test plan

#### Network

So sánh trước/sau ở các flow:

- mở `/cart`
- chuyển qua lại `/profile`, `/payments`, `/myorders`
- reload 2 lần liên tiếp

#### Smoke mutation

- thay đổi địa chỉ mặc định
- hủy đơn
- thanh toán xong quay lại account

Đảm bảo dữ liệu vẫn refresh đúng khi mutation thành công.

#### Build

- `cd client && npm run build`

### 6.13. Edge cases

- token đổi khi user login/logout
- cùng lúc nhiều component gọi cùng một resource
- một request fail giữa chừng
- cart có nhiều item trùng product id

### 6.14. Acceptance criteria

- `/cart` giảm request lặp cho product detail read-path
- account hooks không fetch trùng khi mount gần nhau với cùng token
- có invalidate tối thiểu cho addresses và order/payment read resources
- không đổi behavior UI sau mutation
- `npm run build` pass

---

## 7. Tóm tắt ngắn 5 PR còn lại để giữ bối cảnh roadmap

### PR-06: Image Pipeline Cleanup

**Mục tiêu ngắn:** đồng bộ host policy giữa [`client/src/components/storefront-image.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/storefront-image.tsx) và [`client/next.config.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/next.config.ts), giảm bypass `unoptimized`, giảm CLS/LCP.

**Phạm vi chính:**

- `client/src/components/storefront-image.tsx`
- `client/next.config.ts`
- các màn dùng ảnh lớn như homepage, catalog, PDP

**Kỳ vọng:** giảm layout shift, giảm bytes ảnh, ổn định mobile.

### PR-04: Catalog Query Contract Cleanup

**Mục tiêu ngắn:** giảm catalog index fetch lớn, bỏ sort/filter nặng phía client, làm sạch data flow của [`client/src/components/catalog-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/catalog-page.tsx).

**Phạm vi chính:**

- `client/src/components/catalog-page.tsx`
- `client/src/lib/api/product.ts`
- backend product listing handler/service/repository nếu cần

**Kỳ vọng:** filter và sort mượt hơn, ít main-thread work hơn.

### PR-05: Backend Additive Endpoints

**Mục tiêu ngắn:** thêm endpoint additive để thay resource dedupe tạm ở `PR-03`, ví dụ batch product summary hoặc account order summary.

**Phạm vi chính:**

- product-service
- order-service
- payment-service
- API client tương ứng ở `client`

**Kỳ vọng:** giảm request count mạnh hơn, làm cart/account gọn hơn về kiến trúc.

### PR-07: Shared Contract / Import Boundary

**Mục tiêu ngắn:** đồng bộ lại type/API contract giữa `client` và `frontend`, giảm drift, giảm compatibility barrel dày.

**Phạm vi chính:**

- [`client/src/types/api.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/types/api.ts)
- [`frontend/src/shared/types/api.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/frontend/src/shared/types/api.ts)
- API index/barrel tương ứng

**Kỳ vọng:** code dễ maintain hơn, ít regression do type không đồng bộ.

### PR-08: Stitch Reduction + Runtime/Docs Alignment

**Mục tiêu ngắn:** tách route marketing/atelier khỏi commerce flow, dọn copy/docs/config runtime đang lệch.

**Phạm vi chính:**

- category/atelier routes ở `client`
- `client/README.md`
- root `README.md`
- [`pkg/middleware/cors.go`](/Users/nguyendung/FPT/projects/ecommerce-platform/pkg/middleware/cors.go)
- [`pkg/config/config.go`](/Users/nguyendung/FPT/projects/ecommerce-platform/pkg/config/config.go)

**Kỳ vọng:** làm rõ source of truth UI và giảm phụ thuộc Stitch.

## 8. Template ticket / PR description cho 3 PR đầu

---

## Template PR-01: Route-Level Initial Data

### Title

`[client] PR-01 - Move homepage/catalog/PDP initial data to route-level loaders`

### Summary

Chuyển initial data của homepage, catalog và product detail từ client-side `useEffect` sang route-level/server entry của Next App Router để giảm request waterfall, cải thiện first render và làm rõ boundary giữa route data và interactive client state.

### Context

Hiện tại nhiều route App Router trong `client` chỉ là shell mỏng, trong khi data ban đầu vẫn được fetch sau mount ở client component. Điều này làm:

- first paint chậm
- loading state kéo dài
- App Router chưa phát huy đúng vai trò data boundary

### Scope

- Thêm server fetch helper cho homepage, catalog, product detail
- Route truyền `initialData` hoặc `initialProduct` vào page component
- Sửa page component và hook để dùng initial data

### Non-goals

- Không đổi API backend
- Không redesign catalog query contract
- Không rewrite toàn bộ review/cart/wishlist flow
- Không tối ưu full SSR cho toàn bộ account area

### Technical Plan

1. Tạo helper server-safe cho initial data
2. Sửa route `page.tsx` để load data ở server
3. Thêm props `initialData` / `initialProduct` cho component
4. Sửa hooks để skip initial fetch nếu đã có data
5. Dọn loading states thừa

### Checklist file chạm tới

- [ ] [`client/src/app/page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/app/page.tsx)
- [ ] [`client/src/app/products/page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/app/products/page.tsx)
- [ ] [`client/src/app/products/[productId]/page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/app/products/[productId]/page.tsx)
- [ ] [`client/src/components/home-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/home-page.tsx)
- [ ] [`client/src/components/catalog-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/catalog-page.tsx)
- [ ] [`client/src/components/product-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/product-page.tsx)
- [ ] [`client/src/components/product-page/use-product-page-state.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/product-page/use-product-page-state.ts)
- [ ] helper mới trong `client/src/lib/server/*`

### Migration note

Không có migration dữ liệu hoặc migration backend.

### Test plan

- [ ] `cd client && npm run build`
- [ ] Smoke test `/`, `/products`, `/products/[productId]`
- [ ] Check hydration warnings
- [ ] So sánh waterfall trước/sau bằng DevTools
- [ ] Chạy Lighthouse mobile cho 3 route chính

### Rollout note

- Có thể merge và deploy độc lập
- Nếu có vấn đề, rollback bằng cách bỏ `initialData` và quay về fetch client-side

### Risk assessment

- Rủi ro chính: hydration mismatch và duplicate fetch
- Mức rủi ro: thấp đến trung bình

### Open questions

- Có cần prefetch review list public ở PDP ngay trong PR này không, hay chỉ prefetch `product`?
- `productApi` hiện có đủ server-safe chưa, hay cần server helper dùng `fetch` riêng?

### Definition of done

- Homepage, catalog và PDP có initial data từ route level
- Không phát sinh hydration warnings mới
- Không đổi behavior nghiệp vụ
- Build pass

---

## Template PR-02: Provider Stabilization

### Title

`[client] PR-02 - Stabilize auth/cart providers and reduce global rerenders`

### Summary

Ổn định `AuthProvider` và `CartProvider` bằng cách memoize provider values, giảm broadcast không cần thiết tới các global consumers như `SiteHeader`, đồng thời chuẩn bị nền cho resource dedupe và các tối ưu tiếp theo.

### Context

Hiện tại `auth` và `cart` provider tạo `value` inline, làm tăng khả năng rerender thừa ở các consumer dùng chung trên toàn app. `wishlist` đã có `useMemo`, nên auth/cart đang là phần lệch chuẩn hơn.

### Scope

- Memoize `AuthProvider` value
- Memoize `CartProvider` value
- Memoize derived values như `itemCount`
- Audit `SiteHeader` subscription surface
- Chỉ tách `state/actions` context nếu cần thiết sau khi đo

### Non-goals

- Không đổi auth flow
- Không đổi cart business logic
- Không đưa state library mới
- Không refactor toàn bộ hook API công khai nếu chưa cần

### Technical Plan

1. Thêm `useMemo` cho provider values
2. Đảm bảo callbacks ổn định bằng `useCallback`
3. Tách `clearError` thành callback ổn định
4. Memoize `itemCount`
5. Profile bằng React Profiler
6. Nếu vẫn cần, tách state/actions context nhưng giữ compatibility

### Checklist file chạm tới

- [ ] [`client/src/providers/auth-provider.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/providers/auth-provider.tsx)
- [ ] [`client/src/providers/cart-provider.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/providers/cart-provider.tsx)
- [ ] [`client/src/providers/app-providers.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/providers/app-providers.tsx)
- [ ] [`client/src/components/site-header.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/site-header.tsx)
- [ ] hooks/context helper mới nếu có

### Migration note

Không có migration dữ liệu.

### Test plan

- [ ] `cd client && npm run build`
- [ ] React Profiler cho add-to-cart và login/logout
- [ ] Smoke test badge cart, auth redirect, logout
- [ ] Kiểm tra không có stale behavior ở auth/cart

### Rollout note

- Có thể ship độc lập sau `PR-01`
- Rollback dễ vì chỉ là provider-level refactor

### Risk assessment

- Rủi ro chính: stale closures hoặc thiếu dependency trong memo
- Mức rủi ro: thấp

### Open questions

- Sau khi memoize, có cần tách hẳn `state`/`actions` context ngay không, hay để một PR follow-up?

### Definition of done

- `AuthProvider` và `CartProvider` không còn `value` inline không ổn định
- `SiteHeader` giảm rerender trong Profiler
- Build pass

---

## Template PR-03: Cart/Account Resource Dedupe

### Title

`[client] PR-03 - Add lightweight resource dedupe for cart and account reads`

### Summary

Thêm một lớp resource dedupe tối thiểu cho read-path ở cart và account để giảm request lặp, giảm N+1 fetch và làm sạch data-loading behavior mà chưa cần thêm backend endpoints mới.

### Context

`CartPage`, `useOrderPayments` và `useSavedAddresses` hiện fetch trùng khá nhiều. Đây là read-path overhead rõ ràng, có thể tối ưu sớm bằng cache TTL ngắn và invalidate đơn giản ở client.

### Scope

- Thêm resource cache nhẹ phía client
- Dedupe product reads trong cart
- Dedupe addresses / orders / payments reads trong account
- Thêm invalidate tối thiểu sau mutation

### Non-goals

- Không đưa React Query hoặc state library mới
- Không đổi endpoint backend trong PR này
- Không redesign full account data architecture

### Technical Plan

1. Tạo `resource cache` tối thiểu với:
   - key
   - in-flight promise dedupe
   - TTL ngắn
   - invalidate
2. Tạo key helpers cho account/product reads
3. Áp dụng cho `useSavedAddresses`
4. Áp dụng cho `useOrderPayments`
5. Áp dụng cho `CartPage` product reads
6. Thêm invalidate sau mutation thành công

### Checklist file chạm tới

- [ ] [`client/src/components/cart-page.tsx`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/components/cart-page.tsx)
- [ ] [`client/src/hooks/useOrderPayments.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/hooks/useOrderPayments.ts)
- [ ] [`client/src/hooks/useSavedAddresses.ts`](/Users/nguyendung/FPT/projects/ecommerce-platform/client/src/hooks/useSavedAddresses.ts)
- [ ] `client/src/lib/resources/cache.ts`
- [ ] `client/src/lib/resources/account-resources.ts`
- [ ] `client/src/lib/resources/product-resources.ts`
- [ ] invalidate hook points sau mutation nếu cần

### Migration note

Không có migration dữ liệu hoặc API.

### Test plan

- [ ] `cd client && npm run build`
- [ ] So sánh request count trước/sau ở `/cart`
- [ ] So sánh request count trước/sau ở `/profile`, `/payments`, `/myorders`
- [ ] Test mutation invalidate cho addresses và orders/payments
- [ ] Verify không giữ dữ liệu stale quá lâu

### Rollout note

- Ship độc lập sau `PR-02`
- Nếu thấy stale behavior, rollback bằng cách bỏ resource cache ở hooks/page tương ứng

### Risk assessment

- Rủi ro chính: stale cache hoặc invalidate thiếu
- Mức rủi ro: thấp đến trung bình

### Open questions

- TTL nào là hợp lý nhất cho account read-path ở giai đoạn này?
- Có nên dùng `user.id` thay cho `token` trong resource key nếu available sớm?

### Definition of done

- Cart/account read-path giảm request trùng rõ rệt
- Có invalidate tối thiểu sau mutation quan trọng
- Không đổi behavior người dùng thấy
- Build pass

## 9. Đề xuất cách chia sprint

### Sprint slice đề xuất

#### Slice 1

- `PR-01`

#### Slice 2

- `PR-02`

#### Slice 3

- `PR-03`

#### Slice 4

- `PR-06` và chuẩn bị thiết kế cho `PR-04`

### Lý do chia như vậy

- Mỗi slice đều có giá trị độc lập
- Dễ review
- Dễ rollback
- Không dồn quá nhiều thay đổi kiến trúc vào cùng một lúc

## 10. Kết luận

Nếu cần chọn 3 thay đổi đầu tiên để tối ưu `client` mà vẫn giữ rủi ro thấp, thứ tự đúng là:

1. chuyển initial data về route level
2. ổn định provider
3. dedupe resource read ở cart/account

Ba PR này không yêu cầu rewrite, không yêu cầu thay backend contract, nhưng tạo ra nền rất tốt cho các bước tiếp theo như cleanup catalog contract, endpoint additive và chuẩn hóa boundary toàn hệ thống.
