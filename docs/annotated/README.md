# Backend Annotated Source Map

File này là bản đồ backend chi tiết theo source hiện tại. Mục tiêu không chỉ là biết “feature nằm ở đâu”, mà còn biết:

- hàm nào là entrypoint thật
- hàm nào giữ business invariant
- hàm nào chỉ làm transport, normalize, persistence hoặc retry plumbing
- file nào đáng đọc đầu tiên nếu muốn học backend Go từ repo này

## Cách dùng tài liệu này

1. Mỗi khi đọc một feature, bắt đầu từ `cmd/main.go` của service để thấy wiring thật.
2. Đi tiếp vào `RegisterRoutes` hoặc gRPC server để thấy contract public.
3. Mở service method chính để hiểu rule nghiệp vụ.
4. Chỉ xuống repository khi cần hiểu transaction, SQL, lock, pagination hoặc outbox/inbox.
5. Nếu gặp helper như `normalize*`, `build*`, `scan*`, `Claim*`, `Mark*`, hãy hiểu chúng như “hàm giữ boundary” chứ không phải code phụ vô nghĩa.

## Nền backend dùng chung

| Nhóm | File hoặc hàm | Ý nghĩa |
| --- | --- | --- |
| Config | `pkg/config/config.go:236` `Load` | Gom config runtime của từng service về một điểm vào thống nhất, giúp startup fail-fast nếu thiếu giá trị bắt buộc. |
| PostgreSQL | `pkg/database/postgres.go:34` `NewPostgresDB`, `:54` `RunPostgresMigrations` | Mở DB và chạy migration tại boot; đây là nền chung cho hầu hết service dữ liệu. |
| Auth middleware | `pkg/middleware/auth.go:43` `JWTAuth`, `:99` `RequireRole` | JWT parse và role guard được đẩy ra middleware thay vì lặp ở handler. |
| Logging | `pkg/middleware/logging.go:24` `RequestLogger` | Gắn structured logging cho HTTP request, giữ traceable fields thay vì log string rời. |
| Rate limit | `pkg/middleware/rate_limit.go:53` `NewRedisBackedRateLimiter` | Rate limit dùng Redis làm shared state, phù hợp cho gateway/public route. |
| Request ID | `pkg/observability/context.go:20` `RequestIDMiddleware` | Mỗi request có correlation key để theo dõi xuyên service. |
| Tracing HTTP | `pkg/observability/tracing.go:25` `SetupTracing`, `:66` `EchoMiddleware` | Bật OpenTelemetry cho HTTP path, giúp nhìn call graph thực tế. |
| Tracing gRPC | `pkg/observability/grpc.go:22` `GRPCUnaryServerInterceptor` | Giữ trace continuity ở internal RPC. |
| HTTP response | `pkg/response/response.go` | Chuẩn hoá envelope response để handler không tự phát minh format. |

## API Gateway

### Vai trò

- `api-gateway/cmd/main.go:24` là HTTP entrypoint của toàn bộ stack.
- Gateway chỉ làm proxy, auth middleware, rate limit, tracing, logging, health.
- Business rule của user, product, order, payment không được đặt ở đây.

### Hàm quan trọng

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `api-gateway/cmd/main.go:24` `main` | Load config, dựng Redis/rate limit, tạo service proxy, đăng ký route mirror cho từng backend. |
| `api-gateway/internal/proxy/service_proxy.go:44` `NewServiceProxy` | Tạo HTTP proxy client với timeout, retry, circuit breaker cho một backend service. |
| `api-gateway/internal/proxy/service_proxy_request.go:33` `Do` | Entry point forward request từ gateway xuống backend. |
| `api-gateway/internal/proxy/service_proxy_request.go:72` `newBackendRequest` | Clone method, path, query, body, header và gắn `X-Forwarded-*` cho backend request. |
| `api-gateway/internal/proxy/service_proxy_request.go:141` `executeWithResilience` | Chạy request qua retry/circuit breaker, là lớp bảo vệ I/O chứ không phải logic domain. |
| `api-gateway/internal/proxy/service_proxy_request.go:185` `cloneRetryableRequest` | Tạo request body có thể replay cho retry-safe request. |
| `api-gateway/internal/proxy/service_proxy_request.go:216` `forwardedProto` | Xác định scheme gốc để backend biết request đi từ HTTP hay HTTPS. |
| `api-gateway/internal/handler/*_handler.go` `RegisterRoutes` | Mirror route contract của từng service, giữ gateway mỏng và dễ rà boundary. |

### Điều nên học

- Đây là Proxy Pattern thực dụng: gateway chỉ chuyển tiếp, không “ăn” business logic.
- `ServiceProxy` cho thấy cách thêm resilience vào HTTP inter-service call mà không đụng domain layer.
- Hotspot đáng lưu ý: `newBackendRequest` hiện forward header khá rộng, cần cẩn trọng trust boundary nếu sau này thêm internal header nhạy cảm.

## User Service

### Service ownership

- Boot: `services/user-service/cmd/main.go:41`
- Source of truth: user, profile, role, password hash, email verification, phone verification, address, wishlist, notification preference.
- External integration: email sender, Telegram OTP sender, Google OAuth.

### HTTP handler map

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/handler/user_handler.go:60` `RegisterRoutes` | Đăng ký toàn bộ route auth, profile, OTP signup, verification, OAuth, admin user management. |
| `user_handler.go:111` `Register` | Parse register request, gọi `UserService.Register`, trả token pair và profile. |
| `user_handler.go:148` `Login` | Apply login protection, gọi `UserService.Login`, map sai mật khẩu/throttle sang response phù hợp. |
| `user_handler.go:193` `RefreshToken` | Nhận refresh token và gọi `UserService.RefreshToken` để cấp token pair mới. |
| `user_handler.go:217` `VerifyEmail` | Xác nhận email bằng verification token cũ kiểu link-based. |
| `user_handler.go:236` `ForgotPassword` | Khởi động password reset flow, không leak user existence. |
| `user_handler.go:252` `ResetPassword` | Dùng reset token để đặt mật khẩu mới. |
| `user_handler.go:272` `GetProfile` | Đọc profile theo user ID trong JWT. |
| `user_handler.go:290` `UpdateProfile` | Bind patch profile và chuyển business rule sang service. |
| `user_handler.go:333` `UploadAvatar` | Validate multipart/avatar input rồi gọi upload logic ở service. |
| `user_handler.go:369` `GetPhoneVerificationStatus` | Trả trạng thái challenge OTP điện thoại đang active. |
| `user_handler.go:382` `StartEmailSignup` | Bắt đầu email OTP signup challenge. |
| `user_handler.go:399` `VerifyEmailSignupOTP` | Xác minh OTP email signup và tạo user thật sau khi challenge hợp lệ. |
| `user_handler.go:416` `ResendEmailSignupOTP` | Gửi lại OTP signup email với cooldown/attempt guard. |
| `user_handler.go:433` `StartPhoneSignup` | Bắt đầu phone signup challenge. |
| `user_handler.go:450` `VerifyPhoneSignupOTP` | Xác minh OTP signup qua phone và phát hành token pair. |
| `user_handler.go:467` `ResendPhoneSignupOTP` | Gửi lại OTP signup phone. |
| `user_handler.go:484` `GetEmailVerificationStatus` | Xem trạng thái email verification đang active cho user hiện tại. |
| `user_handler.go:498` `SendEmailVerificationOTP` | Tạo email verification OTP cho user đã đăng nhập. |
| `user_handler.go:512` `VerifyEmailOTP` | Hoàn tất xác minh email bằng OTP. |
| `user_handler.go:534` `ResendEmailVerificationOTP` | Gửi lại OTP verify email. |
| `user_handler.go:556` `SendPhoneOTP` | Gửi OTP verify phone cho profile hiện tại. |
| `user_handler.go:578` `VerifyPhoneOTP` | Xác minh OTP phone và cập nhật verified challenge state. |
| `user_handler.go:600` `ResendPhoneOTP` | Gửi lại OTP phone verification. |
| `user_handler.go:622-691` `handle*Error` | Gom mapping domain error của OTP/signup thành HTTP response nhất quán. |
| `user_handler.go:737` `ChangePassword` | Người dùng đổi mật khẩu sau khi đã đăng nhập. |
| `user_handler.go:765` `ResendVerificationEmail` | Gửi lại email verify kiểu token-link cũ. |
| `user_handler.go:781` `ListUsers` | Admin đọc danh sách user. |
| `user_handler.go:790` `UpdateUserRole` | Admin sửa role của user. |
| `user_handler.go:813` `StartGoogleOAuth` | Redirect người dùng sang Google OAuth start URL. |
| `user_handler.go:817` `GoogleOAuthCallback` | Nhận callback từ Google rồi đổi sang login ticket nội bộ. |
| `user_handler.go:821` `ExchangeOAuthTicket` | Đổi ticket nội bộ thành token pair cuối cùng cho frontend. |
| `user_handler.go:845` `toUploadAvatarInput` | Convert file header thành DTO upload avatar đã kiểm tra content-type/size. |
| `user_handler.go:885` `startOAuth` | HTTP helper cho bước start OAuth. |
| `user_handler.go:912` `handleOAuthCallback` | HTTP helper cho callback OAuth, set/clear nonce cookie và redirect chuẩn. |
| `user_handler.go:952-1024` `clearOAuthNonceCookie`, `extractFrontendRequestOrigin`, `oauthErrorCode`, `oauthErrorMessage`, `describeOAuthProviderError` | Bộ helper transport để handler không lẫn lộn với business logic OAuth. |

### Address, wishlist, notification preference handlers

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/handler/address_handler.go:34` `RegisterRoutes` | Route CRUD address và set-default. |
| `address_handler.go:44` `Create` | Tạo địa chỉ mới cho user. |
| `address_handler.go:72` `List` | Liệt kê address book của user. |
| `address_handler.go:89` `Update` | Sửa một address thuộc user hiện tại. |
| `address_handler.go:118` `Delete` | Xoá địa chỉ khỏi sổ địa chỉ. |
| `address_handler.go:136` `SetDefault` | Đặt một địa chỉ thành default shipping/billing. |
| `internal/handler/wishlist_handler.go:25` `RegisterRoutes` | Route CRUD wishlist và alert listing. |
| `wishlist_handler.go:40` `List` | Lấy wishlist hiện tại kèm snapshot sản phẩm. |
| `wishlist_handler.go:57` `ListAlerts` | Liệt kê wishlist alert cho user. |
| `wishlist_handler.go:74` `ListDispatchableAlerts` | Cấp feed alert cho notification-service pull định kỳ. |
| `wishlist_handler.go:87` `Add` | Thêm một product vào wishlist. |
| `wishlist_handler.go:109` `Sync` | Đồng bộ nhiều product ID vào wishlist. |
| `wishlist_handler.go:134` `Remove` | Xoá item khỏi wishlist. |
| `internal/handler/notification_preference_handler.go:27` `RegisterRoutes` | Route đọc/sửa notification preference. |
| `notification_preference_handler.go:34` `List` | Đọc effective preference map của user. |
| `notification_preference_handler.go:51` `Update` | Upsert preference được client chọn. |
| `internal/handler/login_protection.go:32` `NewLoginAttemptProtector` | Tạo guard chống brute-force cho login endpoint. |
| `login_protection.go:52`, `:71`, `:102` `Check`, `RecordFailure`, `RecordSuccess` | Quản lý lock window và reset trạng thái sau login thành công. |
| `login_protection.go:111-186` helper family | Tạo key theo email/phone/IP và loại bỏ duplicate key để lock hợp lý. |

### gRPC server

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/grpc/user_grpc.go:22` `NewUserGRPCServer` | Dựng adapter gRPC cho UserService. |
| `user_grpc.go:32` `Register` | gRPC wrapper cho register. |
| `user_grpc.go:70` `Login` | gRPC wrapper cho login. |
| `user_grpc.go:106` `GetProfile` | gRPC wrapper cho profile read. |
| `user_grpc.go:142` `UpdateProfile` | gRPC wrapper cho profile patch. |
| `user_grpc.go:181` `optionalStringPointer` | Giữ semantic “field có thể nil” khi map proto -> Go. |
| `user_grpc.go:192` `GetUserByID` | Internal lookup user profile theo ID. |

### Service layer map

#### `user_auth.go`

| Hàm | Ý nghĩa |
| --- | --- |
| `Register` `:35` | Validate register request, hash password, tạo user, gửi verification mail best-effort, build auth response. |
| `Login` `:117` | Tìm user theo email/phone, so khớp password hash, trả token pair. |
| `ChangePassword` `:159` | Xác minh mật khẩu cũ rồi cập nhật hash mới. |
| `buildAuthResponse` `:198` | Gom token pair, profile, avatar thành response hoàn chỉnh. |
| `findUserByIdentifier` `:235` | Chuẩn hoá việc login bằng email hoặc phone. |

#### `user_tokens.go`

| Hàm | Ý nghĩa |
| --- | --- |
| `RefreshToken` `:38` | Parse refresh token, re-load user, phát hành token pair mới. |
| `generateTokenPair` `:76` | Tạo access/refresh JWT từ user aggregate. |

#### `user_profile.go`

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `GetProfile` `:30` | Đọc user và avatar/profile data để trả profile DTO. |
| `UpdateProfile` `:60` | Entry point patch profile; xử lý name, phone, address, verification dependency. |
| `updateProfileWithDependencies` `:114` | Điều phối cập nhật profile khi có phụ thuộc verified phone/address service. |
| `applyVerifiedPhoneChange` `:228` | Chỉ cho phép gắn số điện thoại mới khi challenge đã được verify đúng purpose. |
| `loadUserByID` `:298` | Helper load user với error message rõ ngữ cảnh. |
| `resolveOptionalHumanNameUpdate`, `resolveOptionalHumanName` `:329`, `:417` | Normalize first/last name patch, tránh ghi đè rỗng vô nghĩa. |
| `resolveOptionalPhone` `:365` | Chuẩn hoá phone patch trước khi áp dụng nghiệp vụ verify. |
| `deriveProfileAddressRecipientName` `:378` | Suy ra tên người nhận mặc định cho address từ profile. |
| `resolveOptionalTrimmedText` `:448` | Tránh lưu text chỉ chứa space. |
| `hasMeaningfulProfileAddressPatch`, `mergeProfileAddressInput`, `normalizeProfileAddressInput` `:478-567` | Nhóm helper để phân biệt “user thật sự muốn sửa địa chỉ” với patch rỗng. |
| `isValidProfileAddressInput`, `normalizeAddressField`, `resolveOptionalAddressField`, `isValidRequiredAddressField` `:592-624` | Guard dữ liệu địa chỉ trước khi chạm repository/address service. |

#### `user_avatar.go`

| Hàm | Ý nghĩa |
| --- | --- |
| `UploadAvatar` `:17` | Nhận avatar upload, encode/store metadata và cập nhật avatar record cho user. |

#### `address_service.go`

| Hàm | Ý nghĩa |
| --- | --- |
| `NewAddressService` `:28` | Constructor cho address domain service. |
| `CreateAddress` `:34` | Tạo address mới; nếu request là default thì clear default cũ trước khi create. |
| `GetAddresses` `:79` | Lấy toàn bộ address của user. |
| `GetDefaultAddress` `:83` | Chọn default address từ danh sách hiện có. |
| `UpsertDefaultAddress` `:99` | Tạo hoặc cập nhật default address dựa trên patch profile. |
| `UpdateAddress` `:134` | Sửa address và xử lý semantics default-address. |
| `DeleteAddress` `:180` | Xoá address của user. |
| `SetDefault` `:192` | Clear default cũ rồi set address mới thành mặc định. |

#### `email_signup.go`, `phone_signup.go`

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `StartEmailSignup` `:21`, `StartPhoneSignup` `:22` | Tạo OTP challenge cho signup, validate password confirmation, cooldown và duplicate identity. |
| `VerifyEmailSignupOTP` `:130`, `VerifyPhoneSignupOTP` `:142` | Tiêu thụ challenge đã verify để tạo user thật và trả token pair. |
| `ResendEmailSignupOTP` `:218`, `ResendPhoneSignupOTP` `:233` | Phát hành OTP mới cho challenge còn hiệu lực. |
| `buildEmailSignupStatusResponse` `:272`, `buildPhoneSignupStatusResponse` `:295` | Trả trạng thái cooldown/attempt còn lại cho frontend. |
| `sendEmailSignupOTP` `:297`, `resolvePhoneSignupTelegramChatID` `:320` | Tách riêng channel delivery để logic signup không dính transport. |

#### `email_verification.go`, `phone_verification.go`

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `StartEmailVerificationOTP` `:41`, `StartPhoneVerification` `:44` | Tạo OTP challenge cho user đã đăng nhập muốn verify contact info. |
| `VerifyEmailOTP` `:142`, `VerifyPhoneOTP` `:156` | Kiểm tra mã OTP, đánh dấu challenge verified/consumed. |
| `ResendPhoneOTP` `:214`, `GetPhoneVerificationStatus` `:277`, `buildPhoneVerificationStatusResponse` `:306` | Quản lý lifecycle challenge và UI feedback. |
| `hashOTPCode`, `generateOTPCode`, `resolveTelegramChatID`, `secondsUntil`, `maskPhone` `:331-378` | Helper bảo mật và UX cho OTP flow. |

#### `oauth_service.go`

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `BeginOAuth` `:70` | Tạo signed state, chọn callback URL và trả authorization URL cho frontend. |
| `CompleteOAuthCallback` `:118` | Kiểm tra state/nonce, đổi auth code lấy profile Google, resolve hoặc tạo user, phát hành login ticket nội bộ. |
| `ExchangeOAuthTicket` `:172` | Đổi login ticket nội bộ thành auth response chính thức. |
| `BuildOAuthStartErrorRedirect`, `BuildOAuthErrorRedirect` `:195`, `:203` | Chuẩn hoá redirect khi OAuth fail. |
| `resolveOAuthUser` `:220` | Quyết định user nào sẽ gắn với identity OAuth: user cũ theo provider ID, user cũ theo email, hay user mới. |
| `newOAuthAccountLink`, `applyOAuthIdentity`, `syncOAuthAccount` `:328-377` | Quản lý mapping provider account -> user nội bộ. |
| `newSocialUser`, `syncOAuthUserNameFromProfile`, `generatePlaceholderPasswordHash`, `splitOAuthName` `:388-450` | Tạo user social và đồng bộ tên hiển thị từ provider. |
| `signOAuthState`, `signOAuthLoginTicket`, `parseOAuthState` `:474-484` | Security boundary của OAuth flow. |
| `resolveOAuthCallbackURL`, `resolveFrontendOrigin`, `buildOAuthCallbackURL` `:499-549` | Giữ logic callback/redirect rõ ràng khi có nhiều origin local/dev/prod. |
| `normalizeOAuthProvider`, `normalizeInternalRedirectPath`, `extractOrigin`, `joinHostPort`, `isLocalHostname` `:571-609` | Helper vệ sinh URL/origin để tránh redirect lỏng lẻo. |

#### `auth_recovery.go`

| Hàm | Ý nghĩa |
| --- | --- |
| `VerifyEmail` `:21` | Verify email qua token link cũ. |
| `ResendVerificationEmail` `:38` | Phát hành verification token mới rồi gửi email. |
| `ForgotPassword` `:69` | Tạo password reset token và gửi email best-effort. |
| `ResetPassword` `:96` | Đổi mật khẩu dựa trên reset token hash. |
| `ListUsers` `:118` | Đọc danh sách user cho admin. |
| `UpdateUserRole` `:122` | Chuyển role user sau khi validate role support. |
| `sendVerificationEmail`, `sendPasswordResetEmail` `:146`, `:169` | Tách transport mail khỏi recovery logic. |
| `buildFrontendLink`, `issueTimeBoundToken`, `hashToken`, `isSupportedRole` `:192-218` | Helper tạo token time-bound và validate role enum. |

#### `wishlist_service.go`

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `NewWishlistService` `:31` và các `WithWishlist*` `:39-53` | Wiring catalog client, preference reader, user reader theo kiểu lightweight DI. |
| `ListWishlist` `:59` | Đọc wishlist và enrich bằng product baseline mới nhất. |
| `AddToWishlist` `:63` | Upsert item, sync snapshot sản phẩm tại thời điểm thêm. |
| `SyncWishlist` `:81` | Đồng bộ nhiều product ID vào wishlist chỉ với một lần save batch. |
| `RemoveFromWishlist` `:103` | Xoá item theo user và product. |
| `ListAlerts` `:107` | So snapshot đã lưu với product state mới để tạo alert như restock/price drop. |
| `ListDispatchableAlerts` `:178` | Kết hợp alert với notification preference để notification-service chỉ kéo những alert nên gửi. |
| `normalizeWishlistProductIDs`, `wishlistProductIDs`, `applyProductBaseline`, `applyProductBaselines`, `listProductSnapshots`, `wishlistAlertTopic` `:231-313` | Helper giúp wishlist vừa là persistence feature vừa là alert-source cho downstream service. |

#### `notification_preference_service.go`

| Hàm | Ý nghĩa |
| --- | --- |
| `ListPreferences` `:27` | Đọc preference đã lưu rồi merge với default map. |
| `UpdatePreferences` `:34` | Upsert các topic được hỗ trợ. |
| `PreferenceMap` `:76` | Trả map `topic -> enabled` tiện cho service khác dùng. |
| `listEffectivePreferences`, `defaultNotificationPreferences`, `supportedNotificationTopics`, `isSupportedNotificationTopic`, `flattenNotificationPreferences` `:92-150` | Bộ helper để tránh null-state và giữ enum topic nhất quán. |

#### `user_service.go`, `user_otp_limiter.go`, `dev_account_bootstrapper.go`

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `WithEmailSender` đến `WithEmailVerificationConfig` `:100-323` | Functional options cho các dependency optional hoặc config nhóm OTP/OAuth/avatar/address. |
| `NewUserService` `:349` | Constructor trung tâm, gom repo, JWT, sender, OAuth client, address service và challenge repos. |
| `telegramOTPConfigTTL` đến `allowOTPEvent` `user_otp_limiter.go:22-136` | Rate-control cho OTP qua Redis/in-memory counters, ngăn spam resend. |
| `NewDevAccountBootstrapper`, `Ensure`, `upsertAccount`, `passwordForRole`, `firstNonEmpty` `dev_account_bootstrapper.go:57-158` | Tạo tài khoản dev/staff/admin mẫu cho local environment. |

### Repository, client và persistence map

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/repository/user_repository.go:50` `Create` | Insert user mới, map unique violation cho email/phone. |
| `user_repository.go:93`, `:118`, `:146` `GetByID`, `GetByEmail`, `GetByPhone` | Read path cơ bản của user aggregate. |
| `user_repository.go:169`, `:193` `GetByEmailVerificationTokenHash`, `GetByPasswordResetTokenHash` | Lookup token hash cho verify/reset flow. |
| `user_repository.go:217` `List`, `:252` `Update` | Admin read và update user aggregate. |
| `user_repository.go:302`, `:318`, `:368` helper family | Map unique violation, scan row và chuẩn hoá nullable DB args. |
| `internal/repository/address_repository.go:35-132` | CRUD address, `ClearDefault`, `CountByUserID`; giữ persistence primitive cho address invariant. |
| `internal/repository/wishlist_repository.go:29`, `:63`, `:95`, `:109`, `:145` | Read wishlist, batch upsert, delete item. |
| `internal/repository/notification_preference_repository.go:26`, `:61` | List và upsert notification preferences. |
| `internal/repository/profile_tx_manager.go:23`, `:27` | Transaction coordinator để profile/address flow có thể được gói vào một transaction rõ ràng. |
| `internal/repository/email_signup_repository.go:31-164` | Persistence cho email signup challenge. `DeleteExpired` phục vụ cleanup job tương lai. |
| `internal/repository/email_verification_repository.go:31-160` | Persistence cho email verification challenge. |
| `internal/repository/phone_signup_repository.go:31-167` | Persistence cho phone signup challenge. |
| `internal/repository/phone_verification_repository.go:31-163` | Persistence cho phone verification challenge. |
| `internal/repository/oauth_account_repository.go:31`, `:77`, `:119`, `:150`, `:185` | Lưu mapping user <-> provider account, token refresh và profile snapshot. |
| `internal/repository/user_avatar_repository.go:30`, `:59` | Read/upsert avatar metadata. |
| `internal/client/product_client.go:36`, `:51`, `:107`, `:118` | HTTP client nội bộ để enrich wishlist bằng product snapshot, kèm normalize URL và dedupe ID batch. |

### Điểm mạnh đáng học

- `oauth_service.go` là một flow social login gọn, tách rõ state signing, callback handling và ticket exchange.
- `user_profile.go` cho thấy cách xử lý profile patch phức tạp mà vẫn giữ logic theo intent.
- `wishlist_service.go` biến một feature tưởng nhỏ thành ví dụ đẹp về orchestration, enrichment và downstream notification signal.

### Hotspot

- `address_service.go:34`, `:134`, `:192` đang giữ invariant default-address bằng nhiều bước write liên tiếp; đây là chỗ tốt để siết transaction mạnh hơn.

## Product Service

### Service ownership

- Boot: `services/product-service/cmd/main.go:38`
- Source of truth: product, price, stock, category/storefront metadata, review, search analytics.
- Optional integrations: Elasticsearch, MinIO/object storage.

### HTTP và gRPC entrypoint

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `cmd/main.go:38` `main` | Boot DB, search index, media store, review cache, review observer, low-stock monitor, gRPC server và HTTP server. |
| `cmd/main.go:237` `ensureSearchReady` | Probe search index khi boot để service degrade gracefully nếu search backend chưa sẵn sàng. |
| `internal/handler/product_handler.go:50` `RegisterRoutes` | Đăng ký CRUD product, list/search, analytics, upload, review routes. |
| `product_handler.go:84` `Create` | Admin/staff tạo product. |
| `product_handler.go:103` `GetByID` | Đọc một product. |
| `product_handler.go:115` `ListByIDs` | Batch lookup product theo danh sách ID. |
| `product_handler.go:135` `Update` | Patch product và có thể kích hoạt reindex. |
| `product_handler.go:158` `Delete` | Soft/hard delete product tùy model hiện tại. |
| `product_handler.go:174` `List` | List catalog, hỗ trợ cursor, filter, sort, search. |
| `product_handler.go:224` `SearchAssist` | Trả suggestions/facets cho search UI. |
| `product_handler.go:253` `GetSearchAnalytics` | Admin xem thống kê query/filter/click. |
| `product_handler.go:278` `RecordSearchEvent` | Ghi event click/filter/search từ client. |
| `product_handler.go:311` `parseRequestedProductIDs` | Giới hạn batch size và normalize list. |
| `internal/handler/product_upload_handler.go:23` `UploadImages` | Upload ảnh product qua media store. |
| `product_upload_handler.go:60` `toUploadableImage` | Convert multipart file thành abstraction uploadable image. |
| `internal/handler/product_review_handler.go:17-127` | CRUD review của user cho product. |
| `internal/handler/storefront_handler.go:26` `RegisterRoutes` | Route storefront public như home, categories, category page. |
| `storefront_handler.go:33`, `:53`, `:65` | Entry point cho home/categories/category page. |
| `storefront_handler.go:84` `parseStorefrontHomeLimit` | Guard query param để storefront home không bị limit vô lý. |
| `internal/grpc/product_grpc.go:24` `NewProductGRPCServer` | Adapter gRPC cho product truth. |
| `product_grpc.go:35` `GetProductByID` | Internal product lookup cho cart/order. |
| `product_grpc.go:58` `UpdateProduct` | Internal update path, đặc biệt hỗ trợ stock delta. |
| `product_grpc.go:131`, `:139`, `:212` | Detect request stock-only, áp stock delta và map model -> proto. |

### Service layer map

#### `product_service.go`, `product_crud.go`

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `WithMediaStore`, `WithSearchIndex`, `WithLogger`, `WithSearchAnalytics` `:64-114` | Functional options cho integration optional. |
| `NewProductService` `:137` | Constructor trung tâm cho product domain. |
| `Create` `product_crud.go:32` | Chuẩn hoá input, tạo model product, persist rồi index best-effort. |
| `GetByID` `:64` | Load product theo ID, trả not-found domain error chuẩn. |
| `ListByIDs` `:93` | Batch lookup với normalize/dedupe thứ tự ID. |
| `Update` `:127` | Patch product fields, reindex khi cần. |
| `Delete` `:166` | Xoá product và xoá search index best-effort. |
| `newProductFromCreateRequest`, `applyProductUpdate`, `applyProductImagePatch` `:198-303` | Nhóm helper chuẩn hoá write model, tránh business rule rơi vào handler. |

#### `product_queries.go`, `product_search_assist.go`, `product_helpers.go`

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `List` `product_queries.go:49` | Entry point list catalog; quyết định dùng repository trực tiếp hay search backend. |
| `SyncSearchIndex` `:103` | Reindex toàn bộ product lên search backend. |
| `CheckStock`, `ListLowStock`, `RestoreStock`, `DecreaseStock` `:136-228` | Stock truth API của product-service cho các service khác. |
| `reindexStockChangeBestEffort` `:247` | Reindex stock delta nếu search index tồn tại. |
| `normalizeListProductsQuery`, `toDTO`, `toRepositoryParams`, `shouldUseSearchBackend` `:277-410` | Nhóm helper chuyển boundary query -> normalized query -> repository/search params. |
| `indexProductBestEffort`, `deleteProductIndexBestEffort` `:434`, `:462` | Search là integration phụ, lỗi sẽ bị log chứ không làm hỏng write chính. |
| `GetSearchAssist` `product_search_assist.go:26` | Build suggestion/facet response cho ô search. |
| `expandSearchAssistTerms` `:54` | Tách query thành exact text, tokens, variants để tìm suggestion tốt hơn. |
| `normalizeAssistStatus` `:93` | Chuẩn hoá status filter cho search assist. |
| `recordSearchAnalyticsBestEffort` `:102`, `RecordSearchEvent` `:132` | Ghi analytics mà không chặn UX chính nếu analytics lỗi. |
| `normalizeTags`, `normalizeVariants`, `resolveStock`, `normalizeStatus`, `normalizeProductIDs`, `normalizeImageURLs`, `resolvePrimaryImage`, `normalizeSort`, `trimText` `product_helpers.go:27-303` | Bộ helper giữ write/read path sạch và nhất quán. |

#### `media_upload.go`, `storefront_service.go`

| Hàm | Ý nghĩa |
| --- | --- |
| `EnsureMediaStore` `media_upload.go:26` | Probe bucket/object store khi boot. |
| `UploadImages` `:34` | Upload nhiều ảnh sản phẩm và trả URL/object key. |
| `buildProductImageObjectKey` `:58` | Đặt key ổn định cho object storage. |
| `NewStorefrontService` `storefront_service.go:26` | Service riêng cho storefront public. |
| `ListCategories` `:32` | Liệt kê category public. |
| `GetHome` `:46` | Build home page gồm category/editorial/featured products. |
| `GetCategoryPage` `:111`, `buildCategoryPage` `:128` | Build category page đầy đủ từ nhiều batch query. |
| `sanitizeStorefrontHomeLimit`, `isStorefrontHomeCategory` `:153`, `:164` | Giữ contract storefront ổn định và tránh over-fetch. |

#### Review subsystem

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `NewProductReviewFactory`, `New`, `Update` `product_review_factory.go:19-46` | Factory tạo/patch review model, chuẩn hoá comment và author label. |
| `cloneProductReview`, `normalizeProductReviewComment`, `maskAuthorLabel` `:54-67` | Helper tránh mutate ngoài ý muốn và bảo vệ danh tính reviewer ở mức hiển thị. |
| `NewProductReviewObserverChain` `product_review_observer.go:19`, `Handle` `:35` | Chain nhiều observer sau khi review create/update/delete. |
| `NewProductReviewMetricsObserver` `:48`, `NewProductReviewCacheInvalidationObserver` `:61` | Observer chuyên biệt cho metrics và cache invalidation. |
| `WithProductReviewTxManager`, `WithProductReviewCache`, `WithProductReviewObserver`, `WithProductReviewLogger`, `WithProductReviewFactory` `product_review_service.go:88-112` | Constructor options để review service mở rộng mà không bị cứng vào infra. |
| `NewProductReviewService` `:118` | Dựng review aggregate service. |
| `ListReviews` `:138` | Đọc review summary + first page, ưu tiên cache rồi fallback DB. |
| `GetReviewByProductAndUser` `:189` | Lấy review riêng của current user. |
| `CreateReview`, `UpdateReview`, `DeleteReview` `:215-307` | Write path có tx manager, summary delta, observer và cache invalidation. |
| `createReviewWithRepository`, `loadReviewForMutation`, `runInTx` `:343-368` | Tách rõ orchestration khỏi primitive repository. |
| `loadReviewSummary`, `loadFirstReviewPage`, `loadReviewsFromStore` `:378-454` | Cache-aware read path. |
| `notifyBestEffort`, `warnCacheFailure`, `observeOperation`, `normalizeProductReviewListQuery` `:471-504` | Reliability + observability helpers cho review hot path. |

### Repository map

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/repository/product_repository.go:72-577` | CRUD product, list bằng cursor, stock update/restore, search-index feed, scan helpers, cursor encode/decode, sort clause builder. Đây là repo quan trọng nhất của product-service. |
| `product_search_assist_repository.go:14-325` | Query suggestions, facet values, pattern builder cho search assist. |
| `search_analytics_repository.go:48-351` | Ghi query/event và đọc summary analytics cho admin. |
| `storefront_repository.go:39-366` | Batch read category/editorial/featured product và normalize JSON blobs storefront. |
| `product_review_repository.go:37-312` | CRUD review, lock row for update, review summary, delta apply, row scan, average rating. |
| `product_review_tx_manager.go:21`, `:25` | Transaction runner cho review aggregate. |
| `product_review_cache.go:19-121` | Redis cache cho summary và first page review. Key design rõ theo `productID` và `limit`. |

### Điểm mạnh đáng học

- `product_review_service.go` là mẫu rất sạch cho aggregate phức tạp có cache, observer, metrics, tx manager.
- `product_queries.go` cho thấy cách chọn search backend hay DB backend một cách thực dụng.
- `storefront_service.go` là ví dụ tách public read-model khỏi CRUD core.

### Hotspot

- Review listing vẫn là `page/limit/offset`, chưa lên cursor-first.

## Cart Service

### Service ownership

- Boot: `services/cart-service/cmd/main.go:30`
- Source of truth: cart state trong Redis.
- Product truth vẫn thuộc `product-service`.

### Handler map

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/handler/cart_handler.go:25` `RegisterRoutes` | Route get/merge/add/update/remove/clear cart. |
| `cart_handler.go:36` `GetCart` | Lấy cart hiện tại theo user trong JWT. |
| `cart_handler.go:49` `MergeCart` | Merge guest cart vào server-side cart. |
| `cart_handler.go:80` `AddItem` | Thêm một item, re-check product truth. |
| `cart_handler.go:106` `UpdateItem` | Đổi quantity của item đã có. |
| `cart_handler.go:127` `RemoveItem` | Xoá item khỏi cart. |
| `cart_handler.go:144` `ClearCart` | Xoá toàn bộ cart của user. |

### Service và helper map

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/service/cart_service.go:48` `NewCartService` | Constructor nhận cart repo và product catalog client. |
| `cart_service.go:70` `GetCart` | Load cart hoặc khởi tạo cart trống nếu chưa có state. |
| `cart_service.go:92` `ClearCart` | Xoá cart trong Redis. |
| `cart_mutations.go:13` `MergeCart` | Merge guest items theo product truth và chỉ save một lần. |
| `cart_mutations.go:69` `AddItem` | Load product mới nhất rồi merge vào cart. |
| `cart_mutations.go:121` `UpdateItem` | Chỉnh quantity và subtotal trên snapshot hiện có. |
| `cart_mutations.go:161` `RemoveItem` | Gỡ item và trừ tổng tiền tương ứng. |
| `cart_mutations.go:204` `mergeCartItem` | Gom logic “item đã tồn tại thì cộng quantity, chưa có thì append”. |
| `cart_mutations.go:236` `newCartItem` | Tạo snapshot item từ product truth. |
| `cart_mutations.go:268` `ensureProductStock` | Guard quantity không vượt stock. |
| `cart_helpers.go:38` `loadCart`, `:69` `saveCart` | Bao lớp load/save Redis để mutation code sạch hơn. |
| `cart_helpers.go:96` `getProductForCart` | Tách call gRPC product ra khỏi mutation logic. |
| `cart_helpers.go:138` `findCartItemIndex` | Lookup item trong cart slice. |
| `cart_helpers.go:163` `itemSubtotal` | Tính subtotal một item theo snapshot. |

### Repository và client map

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/repository/cart_repository.go:38` `NewCartRepository` | Redis-backed cart repository. |
| `cart_repository.go:45` `cartKey` | Chuẩn hoá key Redis theo user ID. |
| `cart_repository.go:51`, `:77`, `:90` `Get`, `Save`, `Delete` | Primitive persistence cho cart. |
| `internal/grpc_client/product_client.go:18`, `:34`, `:38` | gRPC client tới product-service, dùng để lấy product truth khi add/merge cart. |

### Điểm mạnh và hotspot

- Điểm mạnh: cart logic mỏng, repo Redis mỏng, product truth không bị duplicate sang cart.
- Hotspot: `UpdateItem` chưa re-check giá và stock mới nhất.

## Order Service

### Service ownership

- Boot: `services/order-service/cmd/main.go:33`
- Source of truth: order, order item snapshot, coupon usage, return, return events, return evidence, refund queue, outbox, inbox.
- External calls: product-service gRPC cho stock/product truth, payment-service HTTP cho payment history/refund.

### Handler map

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/handler/order_handler.go:29` `RegisterRoutes` | Route user/admin cho order, coupon, returns, reports. |
| `order_handler.go:89` `CreateOrder` | Nhận `Idempotency-Key`, gọi `OrderService.CreateOrder`. |
| `order_handler.go:118` `PreviewOrder` | Trả quote trước khi tạo order thật. |
| `order_handler.go:135` `GetOrder` | Lấy order của current user. |
| `order_handler.go:149` `GetReturnEligibility` | Cho frontend biết item nào còn đủ điều kiện hoàn. |
| `order_handler.go:174` `CreateReturn` | Người dùng tạo return request. |
| `order_handler.go:192` `ListOrderReturns` | Liệt kê returns của một order. |
| `order_handler.go:205` `GetReturn` | Đọc chi tiết một return. |
| `order_handler.go:219` `ListUserReturns` | Liệt kê return theo user. |
| `order_handler.go:244` `GetUserOrders` | Liệt kê order của current user. |
| `order_handler.go:256` `GetUserOrderSummary` | Ghép orders với payment history cho màn hình user. |
| `order_handler.go:281` `CancelOrder` | User hủy đơn hợp lệ của chính mình. |
| `order_handler.go:299` `GetOrderTimeline` | Đọc order events/timeline. |
| `order_handler.go:314` `ListAdminOrders` | Admin list orders bằng offset hoặc cursor tùy query param. |
| `order_handler.go:369` `GetAdminOrder` | Admin đọc một order bất kỳ. |
| `order_handler.go:380` `GetAdminOrderTimeline` | Admin xem timeline order. |
| `order_handler.go:395` `UpdateOrderStatus` | Admin/operator đổi trạng thái order. |
| `order_handler.go:430` `UpdateReturnStatus` | Admin/operator đổi trạng thái return. |
| `order_handler.go:460` `RequestReturnRefund` | Queue refund cho return đủ điều kiện. |
| `order_handler.go:488` `ListAdminReturns` | Admin list return queue. |
| `order_handler.go:516` `GetReturnQueueHealth` | Dashboard/health cho refund worker queue. |
| `order_handler.go:530` `CreateCoupon`, `:549` `ListCoupons` | Admin coupon management. |
| `order_handler.go:557` `CancelOrderAsAdmin` | Admin/operator hủy order với audit message. |
| `order_handler.go:591` `GetAdminReport`, `:602` `ListPopularProducts` | Report/dashboard endpoint. |
| `order_handler.go:612`, `:630`, `:661`, `:698` helper family | Parse pagination/time và map pricing/return domain error sang HTTP response. |
| `internal/handler/order_return_evidence_handler.go:23` `UploadReturnEvidence` | Upload hình ảnh/bằng chứng cho return request. |
| `order_return_evidence_handler.go:64`, `:99` | Convert multipart file thành upload struct và whitelist content-type. |

### Core service map

#### `order_service.go`, `order_pricing.go`

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `pricedOrderQuote.ToPreview` `order_service.go:147` | Chuyển quote nội bộ sang DTO preview public. |
| `NewOrderService` `:186` | Constructor gom repo, product client, payment client, RabbitMQ publisher, logger, config. |
| `SetReturnMediaStore` `:202` | Inject object store cho return evidence. |
| `PreviewOrder` `order_pricing.go:48` | Entry point quote order từ request client. |
| `quoteOrder` `:78` | Quote toàn order, bao gồm product lookup, shipping, coupon, rounding. |
| `validateOrderRequest` `:138` | Boundary validation cho create/preview order request. |
| `quoteOrderItem` `:181` | Tạo priced item từ product truth. |
| `newProductQuoteCache`, `getOrLoad` `:227`, `:256` | Cache per-request để không gọi product-service lặp lại cho cùng một product trong một quote. |
| `normalizeShippingMethod`, `normalizeShippingAddress`, `normalizeShippingText` `:291-343` | Chuẩn hoá shipping input. |
| `calculateShippingFee`, `buildShippingOptions`, `resolveShippingPromise` `:366-415` | Contract shipping hiện được backend nắm chủ động. |
| `roundCurrency` `:446` | Gom logic làm tròn tiền về một điểm. |
| `validateCoupon`, `normalizeCouponCode`, `calculateDiscount`, `applyCouponToQuote`, `discountBaseForCoupon` `:469-567` | Subsystem pricing/coupon độc lập, giúp create order không thành God method. |

#### `order_lifecycle.go`, `order_idempotency.go`, `order_reservations.go`

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `CreateOrder` `order_lifecycle.go:42` | Luồng create order hoàn chỉnh: idempotency, quote, reserve stock, persist order/outbox/idempotency record, rollback stock khi persist fail. |
| `UpdateStatus` `:183` | Đổi trạng thái order từ admin/operator path. |
| `CancelOrder`, `CancelOrderAsAdmin` `:241`, `:277` | Hai entrypoint hủy đơn với rule phân quyền khác nhau. |
| `cancelOrderWithActor` `:318` | Shared flow cho mọi path hủy đơn. |
| `newOrderFromQuote` `:386`, `buildOrderItems` `:424` | Tạo order aggregate và order item snapshot từ quote. |
| `persistCreatedOrder` `:460` | Bọc save order + outbox + idempotency record vào một persistence boundary. |
| `logCreateOrderPersistenceError` `:500` | Structured logging helper cho failure nặng ở checkout. |
| `markOrderCancelled`, `restoreCancelledOrderStock`, `reserveCreatedOrderStock`, `restoreOrderItemsStock` `:535-590` | Nhóm helper để state transition và stock compensation rõ ràng. |
| `mapCreateOrderStockError`, `isValidOrderStatus` `:613`, `:642` | Map internal error sang domain error và validate enum status. |
| `normalizeOrderIdempotencyKey`, `hashCreateOrderRequest`, `findIdempotentOrder`, `isOrderUniqueViolation` `order_idempotency.go:20-91` | Bảo vệ checkout khỏi client retry/double submit. |
| `buildOrderReservationExpiry`, `isPendingReservationExpired`, `finalizeOrderReservationState` `order_reservations.go:14-36` | Quản lý pending reservation timeout và stock restoration. |

#### `order_queries.go`, `order_coupon.go`

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `GetOrder`, `GetOrderForAdmin` `order_queries.go:35`, `:64` | Read path cho user và admin với authz khác nhau. |
| `GetUserOrders`, `GetUserOrderSummary` `:86`, `:129` | Read orders của user, ghép thêm payment history từ payment-service. |
| `ListAdminOrders`, `ListAdminOrdersByCursor` `:187`, `:191` | Hai nhánh admin list: offset legacy và cursor-first. |
| `GetOrderTimeline` `:215` | Lấy audit/timeline event của order. |
| `GetAdminReport`, `ListPopularProducts` `:245`, `:275` | Dashboard/report queries cho backoffice. |
| `loadOrderByID`, `buildOrderIDSet`, `groupPaymentHistoryByOrder`, `isOperatorRole` `:297-378` | Helper read model cho summary và authz. |
| `CreateCoupon`, `ListCoupons` `order_coupon.go:35`, `:85` | CRUD coupon ở mức service. |
| `isCouponError`, `isUniqueViolation` `:106`, `:131` | Map lỗi SQL/constraint sang coupon domain error. |

#### Returns và refund worker

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `GetReturnEligibility` `order_return_eligibility.go:10` | Tính snapshot đủ điều kiện return cho từng item. |
| `buildReturnEligibilitySnapshot`, `resolveReturnWindowStart` `:34`, `:105` | Xác định window tính từ delivered/fulfilled event. |
| `CreateReturn` `order_returns.go:16` | Tạo return request từ order đã giao, có validate quantity và trạng thái. |
| `GetReturn`, `ListReturnsByOrder`, `ListUserReturns`, `ListAdminReturns`, `GetReturnQueueHealth` `:80-138` | Read path cho return domain. |
| `UpdateReturnStatus` `:147` | Transition return state và sinh outbox/audit khi cần. |
| `RequestReturnRefund` `:181` | Queue refund khi return đã tới trạng thái phù hợp. |
| `buildReturnItems`, `loadReturnByID`, `isReturnableOrderStatus`, `isValidReturnStatus`, `canTransitionReturnStatus`, `canQueueReturnRefund` `:221-318` | Guard business rule của return domain. |
| `aggregateReturnedQuantities`, `isIgnoredReturnStatus`, `calculateReturnRefundAmount`, `prepareReturnRefund`, `buildReturnRefundIdempotencyKey`, `findRefundableChargePayment` `:324-430` | Tính số lượng đã hoàn, số tiền refund và chọn charge payment để refund. |
| `UploadReturnEvidence` `order_return_evidence.go:15` | Upload bằng chứng cho return đang mở. |
| `buildReturnEvidenceObjectKey`, `isClosedReturnForEvidence` `:72`, `:89` | Tạo object key ổn định và chặn upload vào return đã đóng. |
| `StartReturnRefundWorker` `order_return_refund_worker.go:24` | Background worker polling refund queue. |
| `flushPendingReturnRefunds`, `processPendingReturnRefund` `:46`, `:88` | Claim lease, gọi payment-service refund, complete hoặc reschedule. |
| `nextReturnRefundRetryAt`, `truncateReturnRefundError` `:156`, `:169` | Backoff và error compaction cho queue persistence. |
| `StartReturnRefundQueueMonitor`, `refreshReturnRefundQueueMetrics`, `observeReturnRefundAttempt`, `recordReturnRefundQueueHealth` `order_return_refund_metrics.go:75-106` | Metrics loop cho operability của refund queue. |

#### Eventing

| Hàm hoặc nhóm hàm | Ý nghĩa |
| --- | --- |
| `buildCreatedOrderOutbox`, `buildCancelledOrderOutbox`, `buildReturnOutboxMessage`, `buildOrderOutboxMessage` `order_events.go:46-112` | Tạo payload outbox cho order/return event. |
| `publishOrderEvent`, `publishCancelEvent` `:146`, `:161` | Synchronous publish helper chỉ dùng khi flow cần best-effort publish ngay. |
| `StartOutboxRelay`, `flushOutboxBatch`, `publishOutboxMessage` `:182-239` | Worker relay outbox -> RabbitMQ. |
| `SetupExchange` `:302` | Khai báo RabbitMQ exchange/binding cho order events. |
| `recordAuditEntry`, `messageIDFromDelivery`, `minInt` `:339-363` | Audit helper và utility cho relay/consumer. |
| `StartPaymentEventConsumer`, `handlePaymentEventMessage`, `paymentEventMessage` `payment_events.go:32-183` | Consumer payment lifecycle event để cập nhật order bằng inbox pattern. |

### Repository, client và transport map

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/repository/order_repository.go:91` `CreateWithIdempotency` | Persistence quan trọng nhất của checkout: save order, order items, outbox, idempotency record trong một transaction. |
| `order_repository.go:185`, `:223`, `:253` | Read order theo ID/user và lookup idempotency record. |
| `order_repository.go:271-456` | Persistence cho create/get/list return và queue health. |
| `order_repository.go:587` `AddReturnEvidence` | Gắn URL evidence vào return timeline. |
| `order_repository.go:651`, `:712` `ListAll`, `ListAllByCursor` | Hai mode admin order listing; offset branch là hotspot scalability. |
| `order_repository.go:788`, `:834`, `:893` | Timeline events, update status và expire pending reservation. |
| `order_repository.go:958-1212` | Update return status, schedule/claim/complete/mark-failed refund queue items. |
| `order_repository.go:1231-1427` | Coupon CRUD, admin report, popular products, audit entry. |
| `order_repository.go:1459-2213` helper family | `scan*`, `encode/decode cursor`, `lockAndConsumeCoupon`, outbox/inbox persistence, nullable helper; đây là lớp SQL primitive giữ invariant dữ liệu. |
| `internal/grpc_client/product_client.go:22`, `:49`, `:64`, `:95` | Product truth client cho order-service: get product, decrease stock, restore stock. |
| `internal/client/payment_client.go:54`, `:70`, `:137`, `:171` | HTTP client tới payment-service để lấy payment history, payments theo order và phát refund. |
| `payment_client.go:238`, `:261` | Gắn service authorization và normalize base URL. |

### Điểm mạnh đáng học

- `CreateOrder` là luồng orchestration mạnh nhất của repo.
- `order_repository.go` là ví dụ rõ cho transactional outbox + idempotency record + inbox transition.
- Refund worker cho thấy cách làm background job có lease, retry schedule và metrics mà không cần framework nặng.

### Hotspot

- Nếu UI vẫn gọi `page/limit` thay vì cursor, `ListAdminOrders` vẫn rơi về `COUNT(*) + OFFSET/LIMIT`.

## Payment Service

### Service ownership

- Boot: `services/payment-service/cmd/main.go:31`
- Source of truth: payment, refund, payment idempotency, payment outbox, webhook inbox/audit.
- External dependency: order-service để lấy order truth; MoMo webhook/gateway semantics.

### Handler map

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/handler/payment_handler.go:26` `RegisterRoutes` | Route process/get/list/refund payment và webhook. |
| `payment_handler.go:50` `ProcessPayment` | Nhận payment request + idempotency key. |
| `payment_handler.go:95` `GetPayment` | User đọc payment theo ID. |
| `payment_handler.go:108` `GetPaymentByOrder` | User đọc payment chính theo order. |
| `payment_handler.go:121` `ListPaymentsByOrder` | User đọc toàn bộ payment history theo order. |
| `payment_handler.go:133` `ListPaymentHistory` | User đọc tất cả payment của mình. |
| `payment_handler.go:145` `RefundPayment` | Admin/operator thực hiện refund thủ công. |
| `payment_handler.go:188` `ListPaymentsByOrderAdmin` | Admin đọc payments của một order. |
| `payment_handler.go:200` `ListPaymentsByOrderIDsAdmin` | Admin batch read payments cho nhiều order. |
| `payment_handler.go:222` `HandleMomoWebhook` | Entry point webhook MoMo. |
| `payment_handler.go:245` `parseOrderIDs` | Normalize batch query param cho admin. |

### Service map

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/service/payment_service.go:71` `NewPaymentService` | Constructor gom repo, order client, publisher, logger, config. |
| `payment_processing.go:43` `ProcessPayment` | Entry point process payment với idempotency. |
| `payment_processing.go:62` `processPaymentCore` | Tải order truth, tính outstanding amount, chọn gateway/provider, tạo payment record/outbox. |
| `payment_queries.go:31`, `:63`, `:95`, `:123`, `:134`, `:180` | Read path cho payment theo user/admin và batch grouping theo order IDs. |
| `payment_queries.go:209`, `:218`, `:227` | Enrich payment bằng summary và normalize danh sách order IDs. |
| `payment_refunds.go:41` `RefundPayment` | Refund idempotent, kiểm tra refundable amount, tạo outbox tương ứng. |
| `payment_refunds.go:230` `HandleMomoWebhook` | Verify signature, đối chiếu payment pending, apply webhook result idempotently. |
| `payment_refunds.go:372` `findWebhookPayment` | Lookup payment bằng gateway order ID hoặc hint từ payload webhook. |
| `payment_refunds.go:403` `recordAuditEntry` | Audit payment/refund action. |
| `payment_enrichment.go:33-210` | Tính summary theo order: net paid, total refunded, refundable amount per charge. |
| `payment_idempotency.go:16-53` | Normalize key, hash request body và replay/refuse conflicting retries. |
| `payment_helpers.go:36-273` | Normalize method, resolve gateway provider, build MoMo IDs/URL, verify webhook HMAC, money formatting/rounding, replace payment in slice, generate webhook message ID. |
| `payment_events.go:45` `buildPaymentOutboxMessage` | Tạo event payload cho payment completed/failed/refunded. |
| `payment_events.go:88` `publishPaymentEvent` | Publish helper cho payment event. |
| `payment_events.go:109`, `:131`, `:166` | Outbox relay loop cho payment-service. |
| `payment_events.go:229`, `:239` | Tính routing key và utility nhỏ cho batch relay. |

### Repository và client map

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/repository/payment_repository.go:44`, `:60` | Create payment bình thường hoặc create kèm idempotency record/outbox trong transaction. |
| `payment_repository.go:85-254` | Read payment theo ID/order/user và batch order IDs. |
| `payment_repository.go:271` `Update` | Update payment state và outbox atomically khi cần. |
| `payment_repository.go:305` `CreateAuditEntry` | Ghi audit trail cho refund/webhook/admin action. |
| `payment_repository.go:333` `ApplyWebhookResult` | Inbox-safe update cho webhook replay, vừa ghi inbox message vừa update payment/outbox. |
| `payment_repository.go:394`, `:456`, `:470` | Claim/mark outbox relay state. |
| `payment_repository.go:484-752` helper family | Insert payment/idempotency/outbox/inbox trong transaction, scan rows, build args, nullable/required string helpers. |
| `internal/client/order_client.go:38`, `:53`, `:130` | HTTP client để lấy order truth từ order-service trước khi process payment. |

### Điểm mạnh đáng học

- Payment không tin amount từ client; luôn re-check order truth.
- Webhook path được xử lý như at-least-once delivery, không phải “POST bình thường”.
- Refund idempotency dùng cùng tư duy với create payment, rất đáng học.

## Notification Service

### Service ownership

- Boot: `services/notification-service/cmd/main.go:34`
- Vai trò: consume order/payment/return events, gửi email, lưu inbox/history audit, xử lý retry/DLQ, chạy wishlist alert worker.
- Redis là reliability layer cho dedupe/inbox/history, không phải nguồn business chính.

### Event consumer và inbox HTTP

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `cmd/main.go:34` `main` | Boot RabbitMQ channels, Redis stores, email sender, user client, event handler, queue monitor, wishlist worker. |
| `cmd/main.go:69`, `:72`, `:76` | Chọn Redis deduper thật hay noop deduper tuỳ Redis availability. |
| `cmd/main.go:154` | Dựng wishlist alert worker với user client + deduper + sender. |
| `cmd/main.go:223` `startWorker` | Worker loop với per-message timeout rõ ràng. |
| `internal/handler/event_handler.go:43` `NewEventHandler` | Constructor gom inbox store, history store, retry publisher, preference reader, email sender, logger. |
| `event_handler.go:127` `HandleMessage` | Entry point consume một RabbitMQ delivery, claim inbox, decode metadata, route event, ack/nack/retry. |
| `event_handler.go:250` `processMessage` | Phân luồng payload theo routing key/event type. |
| `event_handler.go:305`, `:342`, `:379`, `:416`, `:453`, `:489` | Xử lý email content cho `order.created`, `payment.completed`, `payment.failed`, `payment.refunded`, `order.cancelled`, `return.*`. |
| `event_handler.go:524` `shouldDeliverTopic` | Kiểm tra notification preference trước khi gửi mail. |
| `event_handler.go:560` `returnEmailContent` | Tạo subject/body cho return event. |
| `event_handler.go:621` `buildHistoryItem`, `:654` `buildRetryAuditItem` | Tạo audit/history model để người dùng/admin truy vết. |
| `event_handler.go:679` `deliveryStatus`, `:686` `buildReturnNarrative` | Chuẩn hoá message hiển thị trong inbox history. |
| `event_handler.go:697` `appendHistoryBestEffort` | Ghi history mà không phá consumer chính nếu Redis lỗi. |
| `event_handler.go:706` `sendEmail` | Tách transport mail khỏi routing event. |
| `event_handler.go:737-759` delivery error helpers | Phân loại permanent vs transient delivery failure cho retry/DLQ decision. |
| `internal/handler/inbox_handler.go:27` `NewNotificationInboxHandler` | HTTP adapter cho inbox/history store. |
| `inbox_handler.go:31`, `:57`, `:84` | List inbox theo user, mark-all-read, xem audit recent. |

### Wishlist alert subsystem

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/service/wishlist_alert_worker.go:32` `NewWishlistAlertWorker` | Constructor worker polling user-service. |
| `wishlist_alert_worker.go:63` `Start` | Vòng lặp poll theo interval và context lifetime rõ ràng. |
| `wishlist_alert_worker.go:84` `runCycle` | Lấy batch alert dispatchable từ user-service rồi gửi từng cái. |
| `wishlist_alert_worker.go:105` `deliver` | Claim dedupe key, gửi email, log failure nhưng tiếp tục batch. |
| `wishlist_alert_worker.go:133` `wishlistAlertEmail` | Tạo subject/body cho alert như price drop hoặc back in stock. |
| `internal/service/wishlist_alert_deduper.go:23` `NewRedisWishlistAlertDeduper` | Dedupe theo Redis khi có infra; fallback noop khi Redis lỗi. |
| `wishlist_alert_deduper.go:38` `Claim` | Đảm bảo một alert không bị gửi lặp nhiều lần trong cửa sổ TTL. |
| `wishlist_alert_deduper.go:55`, `:78` `key`, `ttl` | Xây dedupe key và TTL theo loại alert. |
| `wishlist_alert_deduper.go:89` `noop Claim` | Graceful degradation khi không có Redis. |

### Inbox/history store, messaging, user client

| File hoặc hàm | Ý nghĩa |
| --- | --- |
| `internal/inbox/redis_store.go:32`, `:39`, `:58`, `:70` | Claim/mark-processed/release một message ID để consumer có inbox dedupe state. |
| `redis_store.go:78`, `:82` | Key design cho processed và processing state. |
| `internal/inbox/history_store.go:46`, `:53`, `:99`, `:123`, `:141`, `:175` | Lưu và đọc inbox history/audit items, hỗ trợ mark-all-read. |
| `history_store.go:234`, `:238`, `:242` | Key namespace cho user history và audit feed. |
| `internal/messaging/retry_publisher.go:22`, `:37`, `:77`, `:95` | Requeue message với exponential-like delay, clone headers để giữ retry metadata. |
| `internal/messaging/delivery_metadata.go:19-80` | Parse retry count, first seen time, message ID từ RabbitMQ delivery headers. |
| `internal/messaging/queue_monitor.go:24`, `:32`, `:51`, `:70` | Monitor queue depth/health và declare queue topology. |
| `internal/client/user_client.go:64` `NewUserClient` | HTTP client tới user-service cho notification preferences và wishlist alerts. |
| `user_client.go:83` `PreferenceMap` | Đọc preference của một user trước khi gửi email. |
| `user_client.go:144` `ListDispatchableWishlistAlerts` | Poll batch wishlist alert đã được user-service lọc sẵn. |
| `user_client.go:200`, `:226` | Sign service token và normalize base URL cho internal HTTP call. |

### Điểm mạnh và hotspot

- `event_handler.go` là một consumer at-least-once hoàn chỉnh: claim, dedupe, classify error, retry, audit, append history.
- Hotspot: khi Redis chết, dedupe/history/inbox degrade; service vẫn chạy nhưng duplicate protection giảm.

## Cụm source nên đọc đầu tiên nếu muốn “hiểu sâu”

1. `services/order-service/internal/service/order_lifecycle.go`
2. `services/payment-service/internal/service/payment_processing.go`
3. `services/payment-service/internal/service/payment_refunds.go`
4. `services/notification-service/internal/handler/event_handler.go`
5. `services/product-service/internal/service/product_review_service.go`
6. `services/user-service/internal/service/oauth_service.go`
7. `services/user-service/internal/service/user_profile.go`
8. `services/user-service/internal/service/wishlist_service.go`

## Tóm tắt pattern xuất hiện rõ nhất trong backend

| Pattern | Nơi thấy rõ | Lợi ích |
| --- | --- | --- |
| Thin Handler | Mọi `internal/handler/*.go` | Handler chỉ parse/validate/map response, tránh chôn business rule ở transport layer. |
| Repository Pattern thực dụng | `services/*/internal/repository/*.go` | Tách SQL và transaction primitive khỏi service, nhưng không lạm dụng interface vô nghĩa. |
| Functional Options | `user_service.go`, `product_service.go`, `product_review_service.go` | Constructor dài nhưng vẫn dễ đọc, đặc biệt khi có dependency optional. |
| Transaction Coordinator | `profile_tx_manager.go`, `product_review_tx_manager.go` | Gom nhiều repo call dưới một invariant. |
| Transactional Outbox | `order_repository.go`, `payment_repository.go` + `order_events.go`, `payment_events.go` | Event publish không mất đồng bộ với DB transaction. |
| Inbox / Idempotent Consumer | `order_repository.go:2022`, `payment_repository.go:333`, `notification-service/internal/inbox/*.go` | Replay-safe cho webhook và RabbitMQ consumer. |
| Observer | `product_review_observer.go` | Thêm metrics/cache invalidation mà không làm phình service chính. |
| Worker with Lease | `order_return_refund_worker.go` | Background retry an toàn, tránh double processing. |
| Graceful Degradation | `product-service` search/media boot, `notification-service` Redis fallback | Service chính vẫn sống khi dependency phụ chết. |
