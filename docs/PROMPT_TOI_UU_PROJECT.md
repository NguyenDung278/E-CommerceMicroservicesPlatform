# PROMPT_TOI_UU_PROJECT — Prompt tối ưu project

File này chứa prompt sẵn dùng để giao cho AI agent (Claude Code, v.v.) chạy một lượt tối ưu codebase. Copy nguyên khối trong mục 1, dán vào agent, chọn thêm một module ở mục 2 nếu muốn đào sâu một mảng cụ thể.

Nguyên tắc khi dùng: mỗi lần chạy chỉ giao **một phạm vi** (một mục ở phần 2), yêu cầu verify bằng lệnh thật, và review diff trước khi commit. Prompt càng hẹp, kết quả càng kiểm soát được.

## 1. Prompt nền (luôn dán trước)

```text
Bạn đang làm việc trong repo ecommerce-platform: monorepo Go đa-module (api-gateway,
pkg, proto, services/user|product|cart|order|payment|notification-service — mỗi cái
một go.mod riêng, KHÔNG có go.work) + frontend React 18 + Vite + TS trong client/.

Trước khi sửa bất cứ gì, đọc: CLAUDE.md, AGENTS.md, README.md (mục "Hot Path Khi
Audit Issue"), và HUONG_DAN_CHAY.md.

Ràng buộc bắt buộc:
1. Giữ phân tầng handler → service → repository. Handler không viết SQL, repository
   không biết HTTP status, service không nhận echo.Context, gateway không chứa
   business rule.
2. KHÔNG làm yếu các reliability pattern: transaction bundle (createOrderTx, RunInTx),
   SQL compare-and-set (UpdateStock, ApplyWebhookResult), row lock
   (lockAndConsumeCoupon, FOR UPDATE), cursor pagination, lease-claim outbox
   (ClaimPendingOutbox), inbox/idempotency. Nếu buộc phải đổi, dừng lại và giải trình.
3. Ưu tiên giải pháp đơn giản nhất nhưng robust. Không thêm service/DB/broker/
   framework/library mới khi những gì repo có đã đủ.
4. Docs ở root và docs/ phải khớp path source thật — đổi route/flow/path thì cập
   nhật docs trong cùng thay đổi.
5. Tài liệu và commit viết tiếng Việt.

Quy trình verify sau khi sửa:
- Backend: chạy `make ci` từ root (fmt + tidy + vet + test). Mỗi service phải cd vào
  module mới test lẻ được.
- Frontend: `cd client && npm run lint && npm run build`.
- Chỉ báo cáo "xong" khi các lệnh trên pass; nếu fail, dán output lỗi và dừng.

Cách làm việc:
- Khảo sát trước, sửa sau. Liệt kê phát hiện kèm file:line trước khi đổi code.
- Refactor theo lô nhỏ, mỗi lô xanh CI rồi mới sang lô kế.
- Không đổi hành vi runtime trừ khi được yêu cầu rõ; refactor = giữ nguyên behavior.
```

## 2. Module theo phạm vi (chọn một, dán sau prompt nền)

### 2a. Dọn nợ đã biết (backlog hiện tại)

```text
Xử lý lần lượt các nợ kỹ thuật sau, mỗi mục một commit riêng:
1. shared/ (shared/types/api.ts, shared/web-sdk/) không được client/ hay bất kỳ code
   nào import — xác nhận lại bằng grep, rồi đề xuất: hợp nhất type trùng với
   client/src/types/api.ts hoặc xóa hẳn thư mục. Hỏi trước khi xóa.
2. PROJECTS.md mục 3.x (frontend) mô tả cây frontend/ không tồn tại (repo thật là
   client/ với cấu trúc khác). Viết lại các bảng đó theo source thật.
3. BACKEND_STRUCTURE_VI.md ~1.7MB là file sinh tự động chưa được track — quyết định:
   thêm vào .gitignore hay giữ; nếu giữ thì ghi rõ cách regenerate.
4. Các page frontend còn dài: client/src/pages/product-list-page.tsx (~536 dòng),
   checkout-page.tsx (~530 dòng) — tách section/hook theo đúng pattern đã có ở
   client/src/pages/account/ và client/src/pages/order/.
```

### 2b. Hiệu năng backend

```text
Rà hiệu năng theo thứ tự tác động:
1. N+1 và query trong vòng lặp ở internal/repository của từng service (chú ý các
   upsert lặp từng dòng — cân nhắc batch khi dữ liệu lớn, nhưng giữ idempotency).
2. Thiếu index cho các cột lọc/sắp xếp trong migrations của user/product/order/
   payment-service — đối chiếu query thật trong repository trước khi thêm.
3. Connection pool + timeout: kiểm tra cấu hình sql.DB (SetMaxOpenConns...) và
   context timeout ở gateway/service có nhất quán không.
4. Chỉ đề xuất caching (Redis) khi có đường đọc nóng rõ ràng; nêu chiến lược
   invalidation cụ thể, không cache mù.
Với mỗi phát hiện: nêu bằng chứng (file:line, query), tác động ước tính, cách sửa,
và test chứng minh không đổi hành vi.
```

### 2c. Chất lượng frontend

```text
Rà client/ theo thứ tự:
1. Component > 300 dòng hoặc nhiều trách nhiệm — tách theo pattern pages/account/,
   pages/order/ (section component + hook dữ liệu + helpers).
2. Logic trùng giữa các page (label/format/fetch pattern) — gom về utils/ hoặc hook
   dùng chung như utils/status.ts đã làm.
3. Gọi API rải rác ngoài services/ — kéo về đúng lớp services.
4. State: kiểm tra useEffect thiếu cleanup (cờ active), dependency array sai, và
   Promise không được catch.
Sau mỗi lô: npm run lint && npm run build phải pass.
```

### 2d. Bảo mật

```text
Audit bảo mật theo checklist, chỉ báo lỗi có bằng chứng:
1. Secret: không có secret thật trong repo (.env chỉ chứa giá trị local/placeholder?);
   startup fail fast khi thiếu secret bắt buộc.
2. Input validation ở mọi handler public (gateway + service); SQL chỉ qua placeholder,
   không nối chuỗi.
3. AuthN/AuthZ: route nào thiếu middleware auth? IDOR: mọi query theo user_id lấy từ
   token chứ không từ request body/param?
4. Webhook MoMo: verify chữ ký + idempotency có còn nguyên vẹn không.
5. Rate limit ở gateway phủ các route nhạy cảm (login, OTP, webhook) chưa?
Xuất báo cáo mức độ (cao/trung/thấp) kèm file:line và cách vá.
```

### 2e. Test coverage

```text
Tăng độ phủ test có chủ đích, không chạy theo con số:
1. Liệt kê package internal/service và internal/repository chưa có test ở từng Go
   module ([no test files] khi go test ./...).
2. Ưu tiên test cho: luồng tiền (order pricing, coupon, refund), idempotency
   (webhook replay, outbox/inbox), và các nhánh lỗi của handler.
3. Frontend: thêm test cho utils/ và hook dữ liệu trước, component sau.
Mỗi test mới phải chạy được bằng lệnh chuẩn của repo và nêu rõ nó chốt hành vi nào.
```

## 3. Backlog đã biết (cập nhật 2026-07-15)

| # | Vấn đề | Vị trí | Trạng thái |
| --- | --- | --- | --- |
| 1 | `shared/` không được import từ client — type trùng lặp với `client/src/types/api.ts` | `shared/` | Chưa xử lý |
| 2 | PROJECTS.md §3.x mô tả cây `frontend/` không tồn tại | `PROJECTS.md` | Chưa xử lý |
| 3 | `BACKEND_STRUCTURE_VI.md` ~1.7MB chưa track, không rõ cách regenerate | root | Chưa xử lý |
| 4 | `product-list-page.tsx`, `checkout-page.tsx` còn dài (~530 dòng) | `client/src/pages/` | Chưa xử lý |
| 5 | `account-page.tsx` 1818 dòng | `client/src/pages/account/` | ✅ Đã tách (07/2026) |
| 6 | `order-detail-page.tsx` 864 dòng | `client/src/pages/order/` | ✅ Đã tách (07/2026) |
| 7 | `statusLabel`/`isPositiveStatus` lặp ở 4+ page | `client/src/utils/status.ts` | ✅ Đã gom (07/2026) |
| 8 | `importer.go` 1033 dòng một file | `services/product-service/internal/importer/` | ✅ Đã tách (07/2026) |
| 9 | `event_handler.go` 762 dòng một file | `services/notification-service/internal/handler/` | ✅ Đã tách (07/2026) |
| 10 | Không có khái niệm môi trường — secret default chạy im lặng ở production | `pkg/config` | ✅ APP_ENV + fail-fast (07/2026) |
| 11 | CORS hardcode localhost, không nhận origin production | `pkg/middleware/cors.go` | ✅ Nhận `FRONTEND_BASE_URL` (07/2026) |
| 12 | Token lưu ở localStorage — chấp nhận được cho học tập, nâng cấp thật cần httpOnly cookie + refresh rotation | `client/src/state/auth-context.tsx` | Ghi nhận, chưa xử lý |
| 13 | Client build production nếu API khác origin phải set `VITE_API_BASE_URL` trong `client/.env.production` | `client/` | Đã có template |
