# Annotated: Frontend Auth And Cart Providers

Tài liệu này tập trung vào hai provider quan trọng nhất của frontend hiện tại:

- `AuthProvider`
- `CartProvider`

Đây là hai nơi quyết định gần như toàn bộ behavior “ứng dụng có đang có session không” và “giỏ hàng đang hoạt động theo mode nào”.

File nên mở song song:

- `frontend/src/features/auth/providers/AuthProvider.tsx`
- `frontend/src/features/auth/providers/AuthContext.tsx`
- `frontend/src/features/auth/hooks/useAuth.ts`
- `frontend/src/features/auth/hooks/useSessionToken.ts`
- `frontend/src/features/auth/utils/tokenStorage.ts`
- `frontend/src/features/auth/utils/authStorage.ts`
- `frontend/src/features/auth/utils/oauthState.ts`
- `frontend/src/features/cart/providers/CartProvider.tsx`
- `frontend/src/features/cart/hooks/useCart.ts`
- `frontend/src/features/cart/utils/guestCartStorage.ts`
- `frontend/src/providers/AuthContext.tsx`
- `frontend/src/providers/CartContext.tsx`

## 1. `AuthProvider`: source of truth của session frontend

### State chính

- `token`
- `refreshToken`
- `user`
- `error`
- `isBootstrapping`

Từ đây provider suy ra:

- `isAuthenticated`
- `isAdmin`
- `isStaff`
- `canAccessAdmin`

### Vì sao thiết kế này tốt

Nó gom toàn bộ câu hỏi “user là ai, phiên còn sống không, role gì, có vào admin được không” về đúng một chỗ.

Lợi ích:

- page không phải tự parse JWT
- route guard và layout cùng dựa vào một source of truth
- login/logout/refresh profile không bị tản ra nhiều component

## 2. `useSessionToken`: tách browser storage khỏi auth business flow

### File đang làm gì

- đọc token ban đầu từ storage
- expose `setTokens`, `clearTokens`
- giữ logic remember me
- đồng bộ React state với `localStorage` hoặc `sessionStorage`

### Vì sao code như vậy

Nếu `AuthProvider` vừa xử lý auth flow vừa chạm storage API ở nhiều chỗ, file sẽ khó đọc và khó test hơn.

Tách riêng ra giúp:

- vòng đời token rõ hơn
- dễ thay đổi chiến lược lưu token
- giảm coupling giữa business flow và browser API

### Điều đáng học trong `tokenStorage.ts`

- session token và persistent token dùng key khác nhau
- token đọc từ storage vẫn được kiểm tra và normalize lại
- có helper kiểm tra format JWT và expiration

## 3. Bootstrap session của `AuthProvider`

### Flow chính

1. lấy token/refresh token từ `useSessionToken`
2. nếu không có session:
   - reset `user`
   - clear error
   - `isBootstrapping = false`
3. nếu có session nhưng chưa có `user`:
   - gọi `withFreshToken(...)` để lấy profile
4. nếu request profile fail:
   - clear tokens
   - clear pending OAuth remember
   - reset user

### Vì sao pattern này đáng học

Frontend không coi “có token” là “chắc chắn đang đăng nhập”.

Điều đó tốt vì:

- token hỏng trong storage không làm UI treo ở trạng thái giả authenticated
- bootstrap luôn xác thực lại với backend

## 4. `withFreshToken(...)`: retry đúng chỗ, đúng mức

### Nó đang làm gì

- thử chạy operation với access token hiện tại
- nếu gặp `401` và còn refresh token:
  - gọi refresh
  - chạy lại operation một lần

### Vì sao code như vậy

Đây là refresh strategy thực dụng:

- page không phải tự lặp logic refresh
- chỉ retry trong đúng ngữ cảnh “token cũ không còn hợp lệ”
- không biến mọi lỗi API thành retry vô tội vạ

### Nếu viết cách khác

Nếu mỗi page tự bắt `401` rồi refresh:

- duplication rất nhanh
- dễ tạo race condition
- khó bảo đảm policy nhất quán

## 5. `startTransition(...)` được dùng vì lý do gì

`AuthProvider` và `CartProvider` đều dùng `startTransition` khi cập nhật state sau network/storage.

### Giá trị thực tế

- giảm cảm giác UI bị block
- nói rõ intent: đây là state update hậu quả của async flow, không phải input cần phản hồi ngay

### Khi nào nên dùng mẫu này

- bootstrap session
- đồng bộ cart sau fetch/merge
- cập nhật state sau call API có thể làm re-render lớn

Không nên lạm dụng cho mọi `setState`.

## 6. Action layer của auth

Provider expose các action semantic như:

- `register`
- `login`
- `beginOAuthLogin`
- `exchangeOAuthTicket`
- `logout`
- `refreshProfile`
- `updateProfile`
- `getPhoneVerificationStatus`
- `sendPhoneOtp`
- `verifyPhoneOtp`
- `resendPhoneOtp`
- `resendVerificationEmail`

### Vì sao đây là một pattern tốt

Page gọi action theo ngôn ngữ business:

- “login”
- “update profile”
- “send phone OTP”

Page không cần biết:

- endpoint nào được gọi
- token được refresh ra sao
- `user` được sync lại như thế nào

## 7. OAuth helper utilities: nhỏ nhưng đúng vai trò

### `oauthState.ts`

Lưu lựa chọn `remember` tạm thời trong `sessionStorage` trước khi redirect sang provider OAuth.

### Vì sao cần

- React state sẽ mất khi rời khỏi app để sang Google OAuth
- khi callback quay về, frontend vẫn biết người dùng muốn session persistent hay session-only

### `authStorage.ts`

Chỉ lưu remembered identifier, không lưu password.

Đây là một lựa chọn UX và bảo mật hợp lý hơn việc lưu cả thông tin nhạy cảm.

## 8. `CartProvider`: một abstraction cho hai mode hoạt động khác nhau

### State chính

- `cart`
- `error`
- `isLoading`

### Hai mode hoạt động

#### Guest mode

- source of truth là localStorage
- thêm/cập nhật item bằng cách gọi `productApi.getProductById`
- dùng product authoritative để refresh `name`, `price`, `stock`

#### Authenticated mode

- source of truth là backend `cart-service`
- dùng `cartApi`
- khi login, fetch server cart rồi merge guest cart vào server cart

### Vì sao thiết kế này đáng học

Nó che giấu hai protocol khác nhau dưới cùng một API UI:

- page chỉ biết `addItem`, `updateItem`, `removeItem`, `clearCart`
- provider tự quyết định hành vi theo auth state

Đây là ví dụ tốt của việc tách UI intent khỏi hạ tầng thực thi.

## 9. Guest cart merge: vì sao đang làm ở provider

Trong source hiện tại:

- `cartApi` có helper `mergeCart`
- nhưng backend không có route `/api/v1/cart/merge`
- merge thật đang được thực hiện trong `CartProvider` bằng cách replay `addToCart` từng item

### Vì sao hiện trạng này vẫn chấp nhận được

- không làm mất giỏ guest khi login
- sau mỗi item merge thành công, provider cập nhật phần guest cart còn lại
- nếu lỗi giữa chừng, dữ liệu chưa merge vẫn còn

### Nhược điểm

- nhiều request hơn
- cart lớn sẽ merge chậm hơn
- business glue nằm một phần ở frontend

Đây là ví dụ rất tốt để học về trade-off thực chiến.

## 10. `guestCartStorage.ts`: utility nhỏ nhưng chuẩn vai trò

File này làm ba việc rõ:

- tạo empty cart
- đọc cart từ localStorage
- lưu/xoá cart

### Điều đáng học

- luôn tính lại `total`
- guard môi trường không có `window`
- fail mềm khi JSON parse lỗi

Nếu để logic này rải rác trong page hoặc provider, code sẽ nhanh chóng khó đọc hơn nhiều.

## 11. Vai trò của file compatibility

Repo hiện còn:

- `features/auth/providers/AuthContext.tsx`
- `providers/AuthContext.tsx`
- `providers/CartContext.tsx`

Các file này chủ yếu re-export sang provider thật ở `features/*`.

### Vì sao nên ghi nhớ

Khi debug:

- nếu mở nhầm `providers/AuthContext.tsx`, bạn chỉ đang đứng ở “cửa vào”
- implementation thật vẫn nằm ở `features/auth/providers/AuthProvider.tsx`

## 12. Khi nào cần dùng mẫu tổ chức như thế này

Mẫu `Provider + Hook + Storage helper + API module` rất hợp khi:

- state dùng xuyên app
- có nhiều side effects liên quan auth/cart
- muốn UI gọi action semantic thay vì chạm HTTP/storage trực tiếp

Không cần quá nặng nếu app cực nhỏ và gần như không có shared state.

## 13. Điểm cần ghi nhớ khi học

- auth state không chỉ là token; nó còn là `user`, `refresh logic`, `bootstrap state`
- cart không chỉ là array items; nó là abstraction cho guest mode và authenticated mode
- provider tốt che giấu protocol details, nhưng vẫn lộ ra action semantic rõ ràng

## 14. Lỗi thường gặp

- chỉ clear access token mà quên refresh token
- cho rằng `Boolean(token)` là đủ để coi như authenticated
- nghĩ helper `mergeCart` trong API layer đã được backend hỗ trợ thật
- gọi `useAuth` hoặc `useCart` ngoài provider tree
- sửa file re-export mà không trace đến provider implementation thật

## 15. Cách debug

### Auth

1. Kiểm tra storage bằng DevTools.
2. Xem `AuthProvider` đang stuck ở bootstrap hay không.
3. Kiểm tra request profile/refresh có trả `401` không.
4. Kiểm tra `oauthState.ts` có giữ đúng lựa chọn remember không.

### Cart

1. Xem localStorage guest cart.
2. Kiểm tra merge item đang diễn ra từng cái hay không.
3. Nếu server cart lỗi, trace `CartProvider -> cartApi -> gateway -> cart-service`.
4. Nếu guest cart sai giá hoặc stock, trace `CartProvider -> productApi.getProductById`.

## 16. Mối liên hệ với file khác

- [frontend-app.md](./frontend-app.md)
- [frontend-api-layer.md](./frontend-api-layer.md)
- [frontend-routes-and-flows.md](./frontend-routes-and-flows.md)
- [cart-service.md](./cart-service.md)
