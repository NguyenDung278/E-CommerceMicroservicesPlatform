# Annotated: Frontend App Shell

Doc này tập trung vào lớp boot app và shell điều hướng của `frontend/`.

## File nên mở cùng lúc

- `frontend/src/app/main.tsx`
- `frontend/src/app/app.tsx`
- `frontend/src/app/providers/app-providers.tsx`
- `frontend/src/app/router/protected-route.tsx`
- `frontend/src/app/router/scroll-to-top.tsx`
- `frontend/src/app/layout/app-layout.tsx`

## 1. `main.tsx`

Trách nhiệm rất nhỏ:

- import `styles/index.css`
- mount React app bằng `createRoot`
- bọc `App` trong `StrictMode`

Ý nghĩa: entrypoint mỏng để toàn bộ orchestration thật nằm ở `app.tsx` và `app-providers.tsx`.

## 2. `app.tsx`

Đây là runtime contract của frontend.

Bạn nhìn file này để biết ngay:

- route nào public
- route nào dùng `AppLayout`
- route nào bị chặn bởi `ProtectedRoute`
- redirect compatibility nào đang còn được giữ

Điểm thực tế:

- auth pages không dùng `AppLayout`
- storefront/account/admin nằm dưới cùng một shell
- route account cũ vẫn được redirect về route mới để giữ backward compatibility

## 3. `app-providers.tsx`

Provider tree hiện tại:

1. `AuthProvider`
2. `CartProvider`

Lý do thứ tự này đúng:

- cart cần biết user có token chưa
- cart cần quyết định guest cart hay server cart
- login xong cart phải merge được guest items vào server cart

## 4. `protected-route.tsx`

Đây là boundary authz của app.

Nó xử lý:

- bootstrap session đang chạy thì giữ trạng thái chờ
- chưa login thì redirect về `/login` và giữ `from`
- user không đủ quyền admin/staff thì redirect về `/`

Điểm tốt: page không cần tự viết `if (!user)` lặp đi lặp lại.

## 5. `scroll-to-top.tsx`

Utility nhỏ nhưng có giá trị UX lớn:

- khi `pathname` hoặc `search` đổi thì reset scroll về đầu trang
- page không cần tự lặp side effect này

## 6. `app-layout.tsx`

`AppLayout` chỉ nên đọc như application shell, không phải page business.

Nó đang làm bốn việc:

1. Phân loại surface hiện tại: home/editorial, transactional, account, admin.
2. Lấy global state từ auth/cart.
3. Sinh header/footer/navigation phù hợp với ngữ cảnh.
4. Render `Outlet` cho page thật.

Những điều nên học từ file này:

- header/footer nên đặt ở shell thay vì để từng page tự render
- logic chọn navigation nên dựa vào route context
- shell tốt là shell không fetch data nghiệp vụ của page

## 7. Sau pass refactor này, shell frontend đổi gì

- typography, spacing và focus state của header/footer đã đồng bộ với design token mới
- navigation mobile chuyển sang horizontal overflow thay vì gãy layout
- account surface và transactional surface có cảm giác nhất quán hơn với phần profile/account mới

## 8. Khi cần debug

- Route không match: mở `app.tsx`
- Redirect sai: mở `protected-route.tsx`
- Header/nav lạ: mở `app-layout.tsx`
- Session/bootstrap có vẻ sai: trace tiếp sang `app-providers.tsx -> AuthProvider`
