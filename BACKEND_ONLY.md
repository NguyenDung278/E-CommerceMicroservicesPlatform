# BACKEND_ONLY

## Generation Directives

- Generate Go backend source only.
- Generate API gateway, HTTP handlers, gRPC handlers, services, repositories, models, DTOs, migrations, middleware, config, observability, background workers, tests, and runtime files.
- Do not generate code comments, explanatory documentation blocks, tutorial text, sample prose, or non-runtime notes inside generated source.
- Keep business rules in service packages.
- Keep request parsing, validation, auth extraction, and response mapping in handler packages.
- Keep SQL, Redis, RabbitMQ, object storage, search integration, transactions, locks, row scanning, and persistence mapping in repository packages.
- Keep shared config, database, logger, middleware, observability, response, and validation helpers in `pkg/`.
- Keep gRPC contracts in `proto/`.
- Keep Docker Compose runtime and service YAML config in `deployments/docker/`.
- Keep PostgreSQL as the primary source of truth.
- Use Redis only for cart storage, rate limiting, cache, inbox dedupe, temporary state, or idempotency when justified.
- Use RabbitMQ for asynchronous side effects and retry-safe event delivery.
- Treat MinIO and Elasticsearch as optional integrations that must degrade gracefully.
- Do not add a service, database, broker, framework, or runtime dependency unless the current service, PostgreSQL, existing `pkg/`, and existing async patterns are insufficient.

## Repository Shape

- `api-gateway/`: Echo HTTP gateway, reverse proxy, JWT auth, role gate, tracing, metrics, request logging, Redis-backed rate limiter, retry for safe methods, circuit breaker.
- `services/user-service/`: auth, profile, roles, addresses, wishlist, notification preferences, email verification, phone verification, OAuth exchange, dev account bootstrap.
- `services/product-service/`: product CRUD, image upload, catalog listing, search assist, reviews, gRPC product lookup, optional MinIO, optional Elasticsearch.
- `services/cart-service/`: Redis-backed cart, cart item mutation, cart clear, merge, product validation through gRPC.
- `services/order-service/`: order preview, order creation, idempotency, order events, order timeline, cancellation, coupons, reports, returns, refund queue, payment event handling.
- `services/payment-service/`: payment creation, payment detail/history, refund, MoMo webhook, idempotency, inbox, outbox, audit entries.
- `services/notification-service/`: RabbitMQ consumers, Redis inbox dedupe, retry publisher, notification history, unread state, wishlist alert worker.
- `pkg/config`: default config, YAML config, environment override, DSN/URL helpers.
- `pkg/database`: PostgreSQL connection pool and migration helper.
- `pkg/logger`: structured zap logging.
- `pkg/middleware`: auth, request middleware, rate limit integration.
- `pkg/observability`: request id, HTTP/gRPC tracing, metrics hooks.
- `pkg/response`: standard JSON response envelope.
- `pkg/validation`: shared input validation helpers.
- `proto/`: gRPC contracts used between services.
- `deployments/docker/`: Docker Compose, service config YAML, Postgres init SQL, Prometheus, Grafana, Jaeger, Nginx edge config.

## Layering Rules

- `handler` parses request, validates input, extracts auth context, calls service, and maps domain errors to HTTP/gRPC responses.
- `service` owns business rules, orchestration, domain validation, transaction boundaries, idempotency decisions, and async side-effect decisions.
- `repository` owns SQL, Redis operations, RabbitMQ persistence helpers, transaction implementation, row locks, compare-and-set updates, scans, and persistence error wrapping.
- `model` contains domain and persistence models.
- `dto` contains request and response objects for API boundaries.
- Do not put SQL in handlers.
- Do not put HTTP status codes in repositories.
- Do not pass Echo context into services.
- Do not put business rules in the gateway.
- Create interfaces only for tests, external dependencies, or hiding implementation details from a consumer.
- Prefer placing interfaces at the consumer side.

## Runtime

- Public HTTP entrypoint: `http://localhost:8080`.
- Health endpoint: `GET /health`.
- Jaeger endpoint: `http://localhost:16686`.
- MinIO API endpoint: `http://localhost:9000`.
- MinIO console endpoint: `http://localhost:9001`.
- Elasticsearch endpoint: `http://localhost:9200`.
- PostgreSQL, Redis, RabbitMQ, Prometheus, and Grafana do not publish host ports in the default Compose runtime.
- Compose environment file resolution: `.env.local` first, `.env.example` fallback.
- Service config files: `deployments/docker/config/*.yaml`.
- Service config loader order: defaults, YAML file, environment variables.
- Required production-critical values must fail fast when missing.
- Local defaults must not allow unsafe production startup.

## Data Stores

- PostgreSQL databases:
- `ecommerce_user`
- `ecommerce_product`
- `ecommerce_order`
- `ecommerce_payment`
- PostgreSQL migrations:
- `services/user-service/migrations/`
- `services/product-service/migrations/`
- `services/order-service/migrations/`
- `services/payment-service/migrations/`
- Redis responsibilities:
- cart storage
- rate limiting
- cache when justified
- inbox dedupe
- temporary verification/idempotency state when justified
- RabbitMQ responsibilities:
- order events
- payment events
- return events
- notification delivery
- retry queues
- PostgreSQL service startup must auto-run embedded migrations where current service wiring supports it.
- `deployments/docker/postgres-init/01-create-databases.sql` creates service databases only.

## Make Targets

- `make fmt`: run gofmt for `api-gateway`, `services`, `pkg`, and `proto`.
- `make tidy`: run `go mod tidy` for `pkg`, `api-gateway`, `proto`, and all Go services.
- `make test`: run `go test ./...` for `pkg`, `api-gateway`, `proto`, and all Go services.
- `make vet`: run `go vet ./...` for `pkg`, `api-gateway`, `proto`, and all Go services.
- `make ci`: run `fmt`, `tidy`, `vet`, and `test`.
- `make docker-config`: write Docker Compose config to `/tmp/ecommerce-compose.rendered.yaml`.
- `make compose-build`: build Docker Compose services.
- `make compose-up`: build and run Docker Compose services attached.
- `make compose-down`: stop Docker Compose services.
- `make migrate-up`: run migrations up for user, product, order, and payment databases.
- `make migrate-down`: run migrations down for payment, order, product, and user databases.
- `make migrate-force`: force migration versions to `1` for user, product, order, and payment databases.

## Standard Response Envelope

Successful response:

```json
{
  "success": true,
  "message": "message",
  "data": {},
  "error": null,
  "meta": null
}
```

Error response:

```json
{
  "success": false,
  "message": "validation failed",
  "error": "safe error"
}
```

- Use `pkg/response` for HTTP responses.
- List endpoints may use `page`, `limit`, `total`, `limit`, `next_cursor`, and `has_next` depending on route contract.
- Verify response status, `success`, `message`, `data`, `error`, and `meta`.
- Never expose raw SQL errors, stack traces, DSNs, secrets, token hashes, webhook secrets, internal endpoints, or authorization headers.

## Public HTTP Routes

### Auth

| Method | Route |
| --- | --- |
| `POST` | `/api/v1/auth/register` |
| `POST` | `/api/v1/auth/register/email/send-otp` |
| `POST` | `/api/v1/auth/register/email/verify-otp` |
| `POST` | `/api/v1/auth/register/email/resend-otp` |
| `POST` | `/api/v1/auth/register/phone/send-otp` |
| `POST` | `/api/v1/auth/register/phone/verify-otp` |
| `POST` | `/api/v1/auth/register/phone/resend-otp` |
| `POST` | `/api/v1/auth/login` |
| `POST` | `/api/v1/auth/refresh` |
| `POST` | `/api/v1/auth/verify-email` |
| `POST` | `/api/v1/auth/forgot-password` |
| `POST` | `/api/v1/auth/reset-password` |
| `GET` | `/api/v1/auth/oauth/google/start` |
| `GET` | `/api/v1/auth/oauth/google/callback` |
| `POST` | `/api/v1/auth/oauth/exchange` |

### Users

| Method | Route |
| --- | --- |
| `GET` | `/api/v1/users/profile` |
| `PUT` | `/api/v1/users/profile` |
| `POST` | `/api/v1/users/avatar` |
| `PUT` | `/api/v1/users/password` |
| `GET` | `/api/v1/users/profile/phone-verification` |
| `POST` | `/api/v1/users/profile/phone-verification/send-otp` |
| `POST` | `/api/v1/users/profile/phone-verification/verify-otp` |
| `POST` | `/api/v1/users/profile/phone-verification/resend-otp` |
| `GET` | `/api/v1/users/verify-email/status` |
| `POST` | `/api/v1/users/verify-email/send-otp` |
| `POST` | `/api/v1/users/verify-email/verify-otp` |
| `POST` | `/api/v1/users/verify-email/resend-otp` |
| `POST` | `/api/v1/users/verify-email/resend` |
| `POST` | `/api/v1/users/addresses` |
| `GET` | `/api/v1/users/addresses` |
| `PUT` | `/api/v1/users/addresses/:id` |
| `DELETE` | `/api/v1/users/addresses/:id` |
| `PUT` | `/api/v1/users/addresses/:id/default` |
| `GET` | `/api/v1/users/wishlist` |
| `POST` | `/api/v1/users/wishlist` |
| `POST` | `/api/v1/users/wishlist/sync` |
| `DELETE` | `/api/v1/users/wishlist/:productId` |

### Products And Reviews

| Method | Route |
| --- | --- |
| `GET` | `/api/v1/products` |
| `GET` | `/api/v1/products/batch` |
| `GET` | `/api/v1/products/search/assist` |
| `GET` | `/api/v1/products/:id` |
| `GET` | `/api/v1/products/:id/reviews` |
| `POST` | `/api/v1/products` |
| `POST` | `/api/v1/products/uploads` |
| `PUT` | `/api/v1/products/:id` |
| `DELETE` | `/api/v1/products/:id` |
| `GET` | `/api/v1/products/:id/reviews/me` |
| `POST` | `/api/v1/products/:id/reviews` |
| `PUT` | `/api/v1/products/:id/reviews/me` |
| `DELETE` | `/api/v1/products/:id/reviews/me` |

### Catalog Aggregation

| Method | Route |
| --- | --- |
| `GET` | `/api/v1/storefront/home` |
| `GET` | `/api/v1/storefront/categories` |
| `GET` | `/api/v1/storefront/categories/:identifier` |
| `GET` | `/api/v1/catalog/popularity` |

### Cart

| Method | Route |
| --- | --- |
| `GET` | `/api/v1/cart` |
| `DELETE` | `/api/v1/cart` |
| `POST` | `/api/v1/cart/merge` |
| `POST` | `/api/v1/cart/items` |
| `PUT` | `/api/v1/cart/items/:productId` |
| `DELETE` | `/api/v1/cart/items/:productId` |

### Orders, Returns, Coupons

| Method | Route |
| --- | --- |
| `POST` | `/api/v1/orders/preview` |
| `POST` | `/api/v1/orders` |
| `GET` | `/api/v1/orders/summary` |
| `GET` | `/api/v1/orders` |
| `GET` | `/api/v1/orders/:id/events` |
| `GET` | `/api/v1/orders/:id/return-eligibility` |
| `GET` | `/api/v1/orders/:id` |
| `PUT` | `/api/v1/orders/:id/cancel` |
| `POST` | `/api/v1/orders/:id/returns` |
| `GET` | `/api/v1/orders/:id/returns` |
| `GET` | `/api/v1/returns` |
| `GET` | `/api/v1/returns/:id` |
| `POST` | `/api/v1/returns/:id/evidence` |
| `GET` | `/api/v1/admin/orders/report` |
| `GET` | `/api/v1/admin/orders` |
| `GET` | `/api/v1/admin/orders/:id/events` |
| `GET` | `/api/v1/admin/orders/:id` |
| `PUT` | `/api/v1/admin/orders/:id/cancel` |
| `PUT` | `/api/v1/admin/orders/:id/status` |
| `GET` | `/api/v1/admin/returns` |
| `GET` | `/api/v1/admin/returns/health` |
| `PUT` | `/api/v1/admin/returns/:id/status` |
| `POST` | `/api/v1/admin/returns/:id/refund` |
| `POST` | `/api/v1/admin/coupons` |
| `GET` | `/api/v1/admin/coupons` |

### Payments

| Method | Route |
| --- | --- |
| `POST` | `/api/v1/payments` |
| `GET` | `/api/v1/payments/history` |
| `GET` | `/api/v1/payments/:id` |
| `GET` | `/api/v1/payments/order/:orderId` |
| `GET` | `/api/v1/payments/order/:orderId/history` |
| `POST` | `/api/v1/payments/webhooks/momo` |
| `GET` | `/api/v1/admin/payments/history` |
| `GET` | `/api/v1/admin/payments/order/:orderId/history` |
| `POST` | `/api/v1/admin/payments/:id/refunds` |

- Do not expose `GET /api/v1/payments/:id/verify` unless gateway and service handlers are implemented.

## User Service Requirements

- Support email/password registration.
- Support login.
- Support token refresh.
- Support forgot password.
- Support reset password.
- Support email verification OTP send, verify, resend, and status.
- Support phone verification via Telegram OTP with rate limiting.
- Support Google OAuth start, callback, and exchange.
- Support profile read/update.
- Support password update.
- Support avatar upload with file validation.
- Support address CRUD and default address selection.
- Support wishlist add, list, delete, and sync.
- Support notification preference list/upsert for notification service integration.
- Support dev account bootstrap only for development.
- Preserve email and phone uniqueness at database constraint and repository error mapping level.
- Preserve multi-step profile update through `ProfileTxManager.RunInTx`.
- Track login protection risk: current state is in-memory and must not be treated as distributed protection.

## Product Service Requirements

- Support admin/staff product create, update, delete, and image upload.
- Support public product list with filters and cursor pagination.
- Support product detail lookup.
- Support batch product lookup.
- Support search assist.
- Support catalog aggregation routes.
- Support category data.
- Support product review create, update, delete, summary, cache, and transaction-safe aggregate updates.
- Support gRPC product lookup for cart and order services.
- Support optional MinIO media storage with graceful degradation.
- Support optional Elasticsearch sync/search with graceful degradation.
- Keep product catalog cursor stable for real sort order.
- Keep product listing indexed.
- Keep stock mutation guarded by SQL compare-and-set through `UpdateStock`.
- Benchmark search assist, catalog queries, and review paths before optimizing.
- Track review list paths that still use offset pagination.

## Cart Service Requirements

- Store cart data in Redis with TTL.
- Support get cart.
- Support add item.
- Support update item quantity.
- Support remove item.
- Support clear cart.
- Support merge through `POST /api/v1/cart/merge`.
- Validate product truth through product-service gRPC.
- Avoid treating Redis cart as a transactional inventory source.
- Track concurrent cart writes that still use last-write-wins semantics.

## Order Service Requirements

- Support order preview with subtotal, shipping, coupon, and total calculation.
- Support idempotent order creation using `Idempotency-Key`.
- Scope order idempotency by actor, key, and request hash.
- Return safe replay for same key and same payload.
- Return conflict for same key and different payload.
- Create order, order items, first event, outbox event, and idempotency record in one transaction.
- Serialize coupon usage with row-level lock through `lockAndConsumeCoupon`.
- Support order history.
- Support order detail.
- Support order timeline/events.
- Support order cancellation.
- Support admin order list.
- Support admin order detail.
- Support admin order status update.
- Support admin order report.
- Support coupon create/list.
- Support payment event consumption and guarded order state sync.
- Support return request creation.
- Support return list by order.
- Support return list for current actor with query, status, page, and limit.
- Support return detail authorization.
- Support return status update.
- Support return refund queue through `refund_pending`.
- Support return queue health endpoint.
- Support evidence upload route with multipart field `evidence`.
- Keep returns, return events, refund metadata, and outbox writes transaction-safe.
- Claim pending return refunds using `FOR UPDATE SKIP LOCKED`, lease duration, and retry metadata.
- Complete return refund only after payment refund succeeds.
- Preserve retry metadata when refund worker fails.
- Keep admin list scalability under review where `COUNT(*) + OFFSET/LIMIT` remains.
- Harden inventory reservation across checkout and payment volume growth.

## Return And Refund State Requirements

- Return statuses include `requested`, `approved`, `received`, `refund_pending`, `refunded`, `rejected`, and `cancelled`.
- `refund_pending` stores refund amount, charge payment id, refund payment id, last error, attempt count, requested time, completed time, next retry time, and processing start time.
- `RequestReturnRefund` queues or retries async refund and returns `202`.
- `RequestReturnRefund` returns `409` when a worker owns the lease.
- `RequestReturnRefund` must not call external refund synchronously.
- `prepareReturnRefund` computes refund amount, finds refundable charge payment, and creates idempotency key.
- `calculateReturnRefundAmount` computes refund amount from returned items and allocated discount.
- `findRefundableChargePayment` selects a charge with available refundable balance.
- `StartReturnRefundWorker` owns polling lifecycle through context.
- `flushPendingReturnRefunds` claims due work, processes each item, and schedules retry on failure.
- `processPendingReturnRefund` calls payment refund with idempotency key and completes return on success.

## Payment Service Requirements

- Support idempotent payment creation using `Idempotency-Key`.
- Support payment detail.
- Support payment history.
- Support payment history by order.
- Support admin payment history.
- Support idempotent refund using `Idempotency-Key`.
- Support MoMo webhook with signature verification.
- Support webhook replay safety through inbox and guarded update.
- Support payment event outbox.
- Support audit entries for write paths.
- Replay create/refund for same key and same payload.
- Return conflict for same key and different payload.
- `RefundPayment` must persist refund, outbox, and audit in a transaction.
- `hashRefundPaymentRequest` must include payment id and refund request fields.
- `loadEnrichedPayment` must load refund context from order siblings when needed.
- `ApplyWebhookResult` must decide transition through SQL condition and affected rows.
- Preserve provider contract replay safety when adding another payment provider.

## Notification Service Requirements

- Consume order, payment, and return events from RabbitMQ.
- Use Redis inbox dedupe with claim, processed, and release states.
- Support retry publisher with exponential backoff.
- Support notification history.
- Support mark-all-read.
- Support wishlist alert worker.
- Bind `return.*` routing keys.
- Generate return notification content for `requested`, `approved`, `received`, `refund_pending`, `refunded`, `rejected`, and `cancelled`.
- Treat duplicate message delivery as normal.
- Keep dedupe and retry explicit.
- Track Redis reliability risk on notification inbox paths.

## Async Flow Requirements

- Order service publishes order events.
- Payment service publishes payment events.
- Order service publishes return events.
- RabbitMQ delivers events to notification service.
- Notification service dedupes and retries messages.
- Outbox events must not be detached from the entity transaction that creates the business state.
- Inbox transitions must be idempotent.
- Background workers must have context-owned lifecycle.
- Background workers must expose enough logs and metrics to diagnose stuck work.

## Reliability Patterns

### Transaction Bundle

- Preserve `createOrderTx`.
- Preserve payment `CreateWithIdempotency`.
- Preserve `ProfileTxManager.RunInTx`.
- Preserve `ProductReviewTxManager.RunInTx`.
- Keep related entity writes, outbox writes, and idempotency records in the same transaction.

### SQL Compare-And-Set

- Preserve `UpdateStock`.
- Preserve `ExpirePendingReservation`.
- Preserve `ApplyWebhookResult`.
- Put mutation conditions in SQL `WHERE`.
- Use affected row count to decide mutation or no-op.

### Row Lock

- Preserve `lockAndConsumeCoupon`.
- Preserve `GetReviewByProductAndUserForUpdate`.
- Preserve `SELECT status ... FOR UPDATE` in inbox transitions.
- Serialize critical state in the database.

### Cursor Pagination

- Use cursor pagination for hot paths and fast-growing tables.
- Use deterministic ordering with stable tie-breakers such as `created_at` and `id`.
- Keep product catalog cursor pagination.
- Keep order cursor listing where implemented.
- Use offset pagination only for smaller administrative paths or with explicit acceptance of cost.

### Lease Claim

- Preserve `ClaimPendingOutbox`.
- Preserve `ClaimPendingReturnRefunds`.
- Preserve notification inbox claim logic.
- Use leases so workers can scale horizontally.
- Preserve retry metadata so crashed workers do not lose work.

### Outbox, Inbox, Idempotency

- Use outbox for critical event publishing.
- Use inbox for duplicate-safe event consumption.
- Use idempotency keys for payment create, payment refund, order create, webhook handling, and any important side-effecting POST route.
- Side-effecting POST routes must be safe under request retry.

## Error Handling

- Do not swallow errors silently.
- Wrap errors with `%w` across important boundaries.
- Use `errors.Is` and `errors.As` for domain errors.
- Repository errors must include operation context without leaking secrets.
- Services must map persistence and integration errors into domain errors.
- Handlers must map domain errors to safe HTTP status and response.
- Expected business errors such as validation failure and not found must not be logged as noisy errors.
- Optional dependency failure may degrade only when business behavior remains correct.
- Graceful degradation must include structured logs with enough context.

## Logging

- Use zap structured logging.
- Prefer fields over string concatenation.
- Include `service`, `trace_id`, `span_id`, `user_id`, `order_id`, `payment_id`, `product_id`, `status`, `latency_ms`, and `routing_key` when applicable.
- Do not log passwords.
- Do not log JWTs or refresh tokens.
- Do not log webhook secrets.
- Do not log raw authorization headers.
- Do not log unnecessary sensitive data.

## Context, Timeout, Concurrency

- `context.Context` must be the first argument for I/O or cancellable functions.
- Do not create `context.Background()` in deep layers except for explicitly owned background work.
- Apply deadlines/timeouts to DB, HTTP, gRPC, Redis, and important RabbitMQ publish calls.
- Do not create goroutines without owner, stop condition, error observation, and backpressure strategy.
- Long-running goroutines must stop through context or signal.
- Prefer immutable data flow where practical.
- Prefer database locks or optimistic locking for shared data consistency.
- Do not use mutexes as a substitute for database transaction correctness.

## SQL And Database

- Use parameterized queries.
- Do not concatenate user input into SQL.
- Select only required columns.
- Use named scan/mapper helpers.
- Add indexes for new important queries.
- Put transactions where business invariants are enforced.
- Use `RunInTx` helpers when transaction patterns repeat.
- Use row lock or optimistic locking for inventory, coupon, balance, and payment dedupe.
- Use `EXPLAIN ANALYZE`, metrics, benchmark, or profiling before claiming performance improvement.
- Do not add cache, Redis lock, or Elasticsearch only because a path might be faster.

## API Design

- Use correct route, method, and status semantics.
- Keep request and response contracts stable.
- Validate input at the boundary.
- Keep business rules in services.
- Add gRPC RPCs only when there is real internal service-to-service need.
- Treat proto files as compatibility-sensitive contracts.
- Do not use gRPC as a workaround for unclear service boundaries.
- Require idempotency strategy for important POST routes, payment routes, webhook routes, order routes, inventory routes, and refund routes.

## Security

- Validate input.
- Parameterize queries.
- Enforce authentication.
- Enforce authorization.
- Check file content type and size for uploads.
- Verify webhook signatures.
- Restrict redirect and callback URLs.
- Apply rate limits where abuse is likely.
- Do not hardcode secrets.
- Do not disable verification without explicit bounded replacement.
- Do not open protected routes publicly.

## Observability

- Keep structured logging.
- Keep Prometheus metrics.
- Keep OpenTelemetry tracing.
- Keep Jaeger/Grafana runtime support.
- Important flows must log success and failure paths.
- Cross-boundary HTTP/gRPC flows must preserve traces.
- New background jobs, queue consumers, and external integrations must expose success count, failure count, retry count, processing latency, and dead-letter or poison-message isolation strategy.
- Add metrics for refund worker latency, retry rate, failure rate, outbox lag, and notification retry.

## Testing Requirements

- Service layer requires unit tests for business rules.
- Repository layer requires integration tests for important SQL and transactions.
- Handler layer requires request/response mapping and error status tests.
- Add cross-boundary integration tests only when value is high.
- Prefer table-driven tests when cases share structure.
- Test validation boundaries.
- Test transaction rollback paths.
- Test authorization paths.
- Test pagination, sort, and filter.
- Test webhook/event handling.
- Test duplicate side effects.
- Test race-prone rules.
- Add benchmarks or profiling plans for hot paths.

## API Test Flows

### Smoke

1. `GET /health`
2. `POST /api/v1/auth/login`
3. `GET /api/v1/users/profile`
4. `GET /api/v1/products`
5. `GET /api/v1/storefront/home`

### Core Write Flow

1. Register or login.
2. Verify email status.
3. Send, resend, and verify phone OTP.
4. Create and list address.
5. List products.
6. Add cart item.
7. Preview order.
8. Create order with `Idempotency-Key`.
9. Replay create order with same `Idempotency-Key`.
10. Create payment with `Idempotency-Key`.
11. Replay create payment with same `Idempotency-Key`.
12. Get payment history.

### Admin And Operator Flow

1. Login with staff or admin role.
2. List, create, update, and delete products.
3. Upload product image.
4. List users and update role.
5. Create and list coupons.
6. List orders and update order status.
7. List returns and queue refund.
8. List payments and create refund.

### Negative Tests

- Missing token.
- Wrong role.
- Missing required field.
- Unknown id.
- Negative quantity.
- Zero quantity.
- Invalid coupon.
- Payment create for unauthorized order.
- Refund amount above allowed balance.
- Invalid webhook signature.

### Idempotency Tests

- `POST /api/v1/orders` with key and body creates exactly one order.
- Same order key and same body replays safely.
- Same order key and different body returns conflict.
- `POST /api/v1/payments` with key and body creates exactly one payment.
- Same payment key and same body replays safely.
- Same payment key and different body returns conflict.
- `POST /api/v1/admin/payments/:id/refunds` with key and body creates exactly one refund.
- Same refund key and same body replays safely.
- Same refund key and different body returns conflict.

### Cursor Tests

- `GET /api/v1/products?limit=5` returns first page.
- Following request with `cursor` returns non-overlapping items.
- `has_next` and `next_cursor` reflect remaining data.
- Reusing a cursor with incompatible sort returns invalid cursor.

### Evidence Upload Tests

- `POST /api/v1/returns/:id/evidence` uses multipart form data.
- File field key is `evidence`.
- Valid small image upload returns `201`.
- Return payload includes evidence data.
- Return timeline includes evidence upload event.

### Webhook Tests

- Valid MoMo webhook updates payment state.
- Replayed webhook does not duplicate state transition or outbox effect.
- Invalid signature is rejected.

## DB Verification

### After Create Order

- Check `orders`.
- Check `order_items`.
- Check `order_events`.
- Check `order_idempotency_keys`.
- Check `outbox_events`.

### After Create Payment Or Refund

- Check `payments`.
- Check `payment_idempotency_keys`.
- Check `outbox_events`.
- Check `audit_entries`.

### After Webhook

- Check `payments.status`.
- Check `inbox_messages`.
- Check `outbox_events`.
- Check `orders.status` when payment sync is expected.

### After Return Refund Queue

- Check `returns`.
- Check `refund_attempt_count`.
- Check `refund_last_error`.
- Check `refund_next_retry_at`.
- Check `refund_processing_started_at`.

## Backend Implementation Status

### Gateway And Shared Runtime

- `api-gateway`: done.
- `pkg/config`: done.
- `pkg/observability`: done.
- Keep route map aligned with gateway handlers.
- Fail fast for production-critical config.
- Expand worker metrics.

### User Service

- Email/password auth: done.
- Google OAuth: done.
- Profile update: done.
- Addresses: done.
- Wishlist: done.
- Notification preferences: done.
- Default address invariant requires transaction-safe writes.
- Login protection remains in-memory.

### Product Service

- Product CRUD: done.
- Public catalog: done.
- Catalog aggregation: done.
- Review system: done.
- Product gRPC: done.
- Optional MinIO: done.
- Optional Elasticsearch: done.
- Search assist and facet paths need benchmark coverage.
- Review public list still has offset path risk.

### Cart Service

- Redis cart storage: done.
- Product truth validation: done.
- Merge route: done.
- Concurrent write behavior remains last-write-wins.

### Order Service

- Order preview: done.
- Idempotent order creation: done.
- Order history/detail/timeline: done.
- Admin report and coupons: done.
- Return and refund queue: done.
- Outbox and inbox transition: done.
- Large admin lists still need offset/count reduction.
- Inventory reservation across service boundaries needs hardening.

### Payment Service

- Payment creation: done.
- Payment history/detail: done.
- Refund: done.
- MoMo webhook: done.
- Audit trail: done.
- Provider abstraction remains MoMo-centric.

### Notification Service

- Order/payment/return event consumption: done.
- Redis inbox dedupe: done.
- Retry publisher: done.
- History and unread state: done.
- Wishlist alert worker: done.
- Mark-all-read currently rewrites payload with O(n) behavior.

## Returns And Refund Implementation Map

| Layer | Function | File | Requirement | Status | Tests |
| --- | --- | --- | --- | --- | --- |
| handler | `CreateReturn` | `services/order-service/internal/handler/order_handler.go` | Create return request with boundary validation | done | `TestCreateReturnRouteCreatesRequestedReturn` |
| handler | `ListOrderReturns` | `services/order-service/internal/handler/order_handler.go` | List returns by order | done | compile verify |
| handler | `ListUserReturns` | `services/order-service/internal/handler/order_handler.go` | List returns scoped to current actor with filter and pagination | done | `TestListUserReturnsRouteReturnsMeta` |
| handler | `GetReturn` | `services/order-service/internal/handler/order_handler.go` | Get return by id with authorization | done | compile verify |
| handler | `UpdateReturnStatus` | `services/order-service/internal/handler/order_handler.go` | Update return status for staff/admin | done | `TestAdminUpdateReturnStatusRouteUpdatesReturn` |
| handler | `RequestReturnRefund` | `services/order-service/internal/handler/order_handler.go` | Queue async refund or reject in-flight lease | done | `TestAdminRequestReturnRefundRouteQueuesRefundPending`, `TestAdminRequestReturnRefundRouteReturnsConflictWhenRefundIsInFlight` |
| handler | `ListAdminReturns` | `services/order-service/internal/handler/order_handler.go` | List all returns with filter and pagination | done | `TestListAdminReturnsRouteReturnsMeta` |
| handler | `GetReturnQueueHealth` | `services/order-service/internal/handler/order_handler.go` | Return queue health snapshot | done | `TestGetReturnQueueHealthRouteReturnsSnapshot` |
| service | `CreateReturn` | `services/order-service/internal/service/order_returns.go` | Reject over-return, require delivered order, create event and outbox | done | `TestCreateReturnCreatesRequestedReturnForDeliveredOrder`, `TestCreateReturnRejectsQuantityAbovePurchasedAmount`, `TestCreateReturnRejectsAlreadyReturnedQuantity` |
| service | `ListUserReturns` | `services/order-service/internal/service/order_returns.go` | Normalize pagination and enforce actor scope | done | `TestListUserReturnsNormalizesPaginationAndScopesUser` |
| service | `ListAdminReturns` | `services/order-service/internal/service/order_returns.go` | Normalize filter and pagination bounds | done | `TestListAdminReturnsNormalizesPaginationBounds` |
| service | `GetReturnQueueHealth` | `services/order-service/internal/service/order_returns.go` | Read queue health snapshot from repository | done | `TestGetReturnQueueHealthReturnsRepositorySnapshot` |
| service | `UpdateReturnStatus` | `services/order-service/internal/service/order_returns.go` | Validate transition and write event/outbox transactionally | done | `TestUpdateReturnStatusTransitionsApprovedAndWritesOutbox`, `TestUpdateReturnStatusRejectsInvalidTransition`, `TestUpdateReturnStatusRejectsInvalidStatus`, `TestUpdateReturnStatusReturnsNilWhenStatusIsUnchanged` |
| service | `RequestReturnRefund` | `services/order-service/internal/service/order_returns.go` | Queue `refund_pending`, prevent double queue while lease exists | done | `TestRequestReturnRefundQueuesRefundPending`, `TestRequestReturnRefundRejectsWhileWorkerOwnsLease`, `TestRequestReturnRefundReturnsNilWhenAlreadyRefunded`, `TestRequestReturnRefundRejectsRequestedStatus`, `TestRequestReturnRefundRetriesExistingPendingRefundWithoutRepricing` |
| service | `prepareReturnRefund` | `services/order-service/internal/service/order_returns.go` | Compute refund metadata and idempotency key | done | queue refund tests |
| service | `calculateReturnRefundAmount` | `services/order-service/internal/service/order_returns.go` | Calculate refund amount with discount allocation | done | queue refund and worker tests |
| service | `findRefundableChargePayment` | `services/order-service/internal/service/order_returns.go` | Find charge payment with enough refundable balance | done | queue refund tests |
| service | `StartReturnRefundWorker` | `services/order-service/internal/service/order_return_refund_worker.go` | Poll and process pending return refunds | done | compile verify |
| service | `flushPendingReturnRefunds` | `services/order-service/internal/service/order_return_refund_worker.go` | Claim retry-due returns and schedule retry on failure | done | `TestReturnRefundWorkerMarksFailureForRetry` |
| service | `processPendingReturnRefund` | `services/order-service/internal/service/order_return_refund_worker.go` | Call payment refund idempotently and complete return | done | `TestReturnRefundWorkerCompletesQueuedRefund` |
| repository | `ListReturns` | `services/order-service/internal/repository/order_repository.go` | Query returns with status/query filter and pagination | done | service/handler tests |
| repository | `GetReturnQueueHealth` | `services/order-service/internal/repository/order_repository.go` | Aggregate pending, retry, in-flight, and recent failures | done | service/handler tests |
| repository | `ScheduleReturnRefund` | `services/order-service/internal/repository/order_repository.go` | Set `refund_pending`, insert event, insert outbox in transaction | done | queue refund tests |
| repository | `ClaimPendingReturnRefunds` | `services/order-service/internal/repository/order_repository.go` | Claim jobs with `FOR UPDATE SKIP LOCKED`, lease, and retry metadata | done | worker tests |
| repository | `CompleteReturnRefund` | `services/order-service/internal/repository/order_repository.go` | Mark return refunded with payment id, event, and outbox | done | worker success test |
| repository | `MarkReturnRefundAttemptFailed` | `services/order-service/internal/repository/order_repository.go` | Persist retry error and next retry time | done | worker failure test |
| payment caller | `RefundPayment` | `services/order-service/internal/client/payment_client.go` | Call payment refund endpoint with service JWT and idempotency key | done | worker tests |

## Payment Refund Idempotency Map

| Layer | Function | File | Requirement | Status | Tests |
| --- | --- | --- | --- | --- | --- |
| handler | `RefundPayment` | `services/payment-service/internal/handler/payment_handler.go` | Require `Idempotency-Key` for refund | done | payment service tests |
| service | `RefundPayment` | `services/payment-service/internal/service/payment_refunds.go` | Replay matching request, reject key reuse with different payload | done | `TestRefundPaymentReplaysCompletedRequestByIdempotencyKey`, `TestRefundPaymentRejectsIdempotencyKeyReuseForDifferentPayload` |
| service | `hashRefundPaymentRequest` | `services/payment-service/internal/service/payment_idempotency.go` | Hash refund payload for replay/conflict checks | done | service tests |
| service | `loadEnrichedPayment` | `services/payment-service/internal/service/payment_queries.go` | Load refund context from order-related payments | done | refund replay tests |

## Backend Backlog

- Upload return evidence using object storage with content type and size validation.
- Add shipping label and carrier integration for returns.
- Add Prometheus metrics for refund worker.
- Reduce large admin lists that still depend on `COUNT(*) + OFFSET/LIMIT`.
- Add metrics for outbox lag and notification retry.
- Standardize transaction helper usage for multi-write flows beyond profile and review.
- Benchmark product search assist, catalog queries, and review paths.
- Harden inventory reservation across checkout and payment boundaries.
- Keep docs and tests aligned with gateway routes, service handlers, service logic, repositories, migrations, and runtime config.

## Required Source Checks Before Backend Changes

- `deployments/docker/docker-compose.yml`
- `deployments/docker/config/*.yaml`
- `api-gateway/cmd/main.go`
- `api-gateway/internal/handler/*.go`
- `api-gateway/internal/proxy/*.go`
- `services/*-service/cmd/main.go`
- `services/*-service/internal/handler/`
- `services/*-service/internal/grpc/`
- `services/*-service/internal/service/`
- `services/*-service/internal/repository/`
- `services/*-service/internal/model/`
- `services/*-service/internal/dto/`
- `services/*-service/migrations/`
- `pkg/config/config.go`
- `pkg/middleware/*`
- `pkg/observability/*`
- `proto/`

## Merge Checklist

- Code follows `handler -> service -> repository`.
- Names reflect domain intent.
- Error wrapping and domain error mapping are correct.
- Logs include useful context and exclude sensitive data.
- New query has supporting index or documented bounded scope.
- Offset pagination is avoided on hot paths.
- External calls have timeout and retry/idempotency strategy where appropriate.
- Background workers have lifecycle and observable errors.
- Tests cover success path, error path, and core business rule.
- Runtime config is present in `pkg/config`, service YAML, Docker Compose, and environment examples when required.
- Public route changes are reflected in gateway handler tests and API tests.
