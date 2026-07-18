SHELL := /bin/bash
PATH := /usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$(PATH)

MODULES := pkg api-gateway proto services/user-service services/product-service services/cart-service services/order-service services/payment-service services/notification-service
DOCKER_BUILDKIT ?= 1
COMPOSE_DOCKER_CLI_BUILD ?= 1
COMPOSE_DIR := deployments/docker
COMPOSE_ENV_FILE ?= $(if $(wildcard $(CURDIR)/.env.local),$(CURDIR)/.env.local,$(CURDIR)/.env.example)
COMPOSE_PROFILE_ARGS := $(if $(strip $(COMPOSE_PROFILES)),--profile $(COMPOSE_PROFILES),)
SERVICES ?=
COMPOSE_NETWORK ?= ecommerce-network
POSTGRES_CONTAINER ?= ecommerce-postgres
GO_DOCKER_IMAGE ?= golang:1.25-alpine
POSTGRES_CLIENT_IMAGE ?= postgres:15-alpine
MIGRATE_DOCKER_IMAGE ?= migrate/migrate:v4.18.3

# Database connection details for migrations.
# Keep migration targets aligned with the per-service databases created by Docker Compose.
POSTGRES_HOST ?= localhost
POSTGRES_PORT ?= 5432
POSTGRES_USER ?= admin
POSTGRES_PASSWORD ?= change-me-db-password
POSTGRES_SSLMODE ?= disable
USER_DB_URL ?= postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_HOST):$(POSTGRES_PORT)/ecommerce_user?sslmode=$(POSTGRES_SSLMODE)
PRODUCT_DB_URL ?= postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_HOST):$(POSTGRES_PORT)/ecommerce_product?sslmode=$(POSTGRES_SSLMODE)
ORDER_DB_URL ?= postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_HOST):$(POSTGRES_PORT)/ecommerce_order?sslmode=$(POSTGRES_SSLMODE)
PAYMENT_DB_URL ?= postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_HOST):$(POSTGRES_PORT)/ecommerce_payment?sslmode=$(POSTGRES_SSLMODE)

.PHONY: fmt tidy test vet ci docker-config compose-build compose-up compose-down docker-config-prod compose-up-prod compose-down-prod client-install client-dev client-build client-preview k8s-apply k8s-delete migrate-up migrate-down migrate-force storefront-import-dry-run storefront-import-sample storefront-reset-sample storefront-explain-home

CATALOG_WORKBOOK ?= $(CURDIR)/artifacts/import-templates/catalog-import-sample-workbook.xlsx
CATALOG_WORKBOOK_CONTAINER ?= /workspace/artifacts/import-templates/catalog-import-sample-workbook.xlsx
PRODUCT_CONFIG_CONTAINER ?= /workspace/deployments/docker/config/product-service.yaml
STOREFRONT_RESET_SQL ?= /workspace/artifacts/sql/storefront-reset-sample.sql
STOREFRONT_EXPLAIN_SQL ?= /workspace/artifacts/sql/storefront-explain-home.sql

fmt:
	@find api-gateway services pkg proto -name '*.go' -print0 | xargs -0 gofmt -w

tidy:
	@for module in $(MODULES); do \
		echo "==> go mod tidy $$module"; \
		(cd $$module && go mod tidy) || exit 1; \
	done

test:
	@for module in $(MODULES); do \
		echo "==> go test $$module"; \
		(cd $$module && go test ./...) || exit 1; \
	done

vet:
	@for module in $(MODULES); do \
		echo "==> go vet $$module"; \
		(cd $$module && go vet ./...) || exit 1; \
	done

ci: fmt tidy vet test

docker-config:
	@cd $(COMPOSE_DIR) && DOCKER_BUILDKIT=$(DOCKER_BUILDKIT) COMPOSE_DOCKER_CLI_BUILD=$(COMPOSE_DOCKER_CLI_BUILD) docker compose --env-file $(COMPOSE_ENV_FILE) $(COMPOSE_PROFILE_ARGS) config >/tmp/ecommerce-compose.rendered.yaml && echo "Rendered compose saved to /tmp/ecommerce-compose.rendered.yaml"

# Production: dùng .env.production (copy từ .env.production.example, KHÔNG commit).
# Service sẽ fail fast nếu APP_ENV=production mà secret còn giá trị mặc định.
PROD_ENV_FILE := $(CURDIR)/.env.production

docker-config-prod:
	@test -f $(PROD_ENV_FILE) || { echo "Thiếu .env.production — copy từ .env.production.example và điền secret."; exit 1; }
	@$(MAKE) docker-config COMPOSE_ENV_FILE=$(PROD_ENV_FILE)

compose-up-prod:
	@test -f $(PROD_ENV_FILE) || { echo "Thiếu .env.production — copy từ .env.production.example và điền secret."; exit 1; }
	@$(MAKE) compose-up COMPOSE_ENV_FILE=$(PROD_ENV_FILE)

compose-down-prod:
	@test -f $(PROD_ENV_FILE) || { echo "Thiếu .env.production — copy từ .env.production.example và điền secret."; exit 1; }
	@$(MAKE) compose-down COMPOSE_ENV_FILE=$(PROD_ENV_FILE)

compose-build:
	@cd $(COMPOSE_DIR) && DOCKER_BUILDKIT=$(DOCKER_BUILDKIT) COMPOSE_DOCKER_CLI_BUILD=$(COMPOSE_DOCKER_CLI_BUILD) docker compose --env-file $(COMPOSE_ENV_FILE) $(COMPOSE_PROFILE_ARGS) build --progress plain $(SERVICES)

compose-up:
	@cd $(COMPOSE_DIR) && DOCKER_BUILDKIT=$(DOCKER_BUILDKIT) COMPOSE_DOCKER_CLI_BUILD=$(COMPOSE_DOCKER_CLI_BUILD) docker compose --env-file $(COMPOSE_ENV_FILE) $(COMPOSE_PROFILE_ARGS) up --build $(SERVICES)

compose-down:
	@cd $(COMPOSE_DIR) && DOCKER_BUILDKIT=$(DOCKER_BUILDKIT) COMPOSE_DOCKER_CLI_BUILD=$(COMPOSE_DOCKER_CLI_BUILD) docker compose --env-file $(COMPOSE_ENV_FILE) $(COMPOSE_PROFILE_ARGS) down

client-install:
	@cd client && npm install

client-dev:
	@cd client && npm run dev

client-build:
	@cd client && npm run build

client-preview:
	@cd client && npm run preview

k8s-apply:
	kubectl apply -f deployments/k8s/

k8s-delete:
	kubectl delete -f deployments/k8s/ --ignore-not-found

migrate-up:
	@echo "==> Running migrations UP for all services"
	@POSTGRES_USER="$$(grep -E '^POSTGRES_USER=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_PASSWORD="$$(grep -E '^POSTGRES_PASSWORD=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_USER="$${POSTGRES_USER:-admin}"; \
	POSTGRES_PASSWORD="$${POSTGRES_PASSWORD:-change-me-db-password}"; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		"$(MIGRATE_DOCKER_IMAGE)" \
		-path /workspace/services/user-service/migrations \
		-database "postgres://$$POSTGRES_USER:$$POSTGRES_PASSWORD@postgres:5432/ecommerce_user?sslmode=disable" up; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		"$(MIGRATE_DOCKER_IMAGE)" \
		-path /workspace/services/product-service/migrations \
		-database "postgres://$$POSTGRES_USER:$$POSTGRES_PASSWORD@postgres:5432/ecommerce_product?sslmode=disable" up; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		"$(MIGRATE_DOCKER_IMAGE)" \
		-path /workspace/services/order-service/migrations \
		-database "postgres://$$POSTGRES_USER:$$POSTGRES_PASSWORD@postgres:5432/ecommerce_order?sslmode=disable" up; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		"$(MIGRATE_DOCKER_IMAGE)" \
		-path /workspace/services/payment-service/migrations \
		-database "postgres://$$POSTGRES_USER:$$POSTGRES_PASSWORD@postgres:5432/ecommerce_payment?sslmode=disable" up

migrate-down:
	@echo "==> Running migrations DOWN for all services"
	@POSTGRES_USER="$$(grep -E '^POSTGRES_USER=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_PASSWORD="$$(grep -E '^POSTGRES_PASSWORD=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_USER="$${POSTGRES_USER:-admin}"; \
	POSTGRES_PASSWORD="$${POSTGRES_PASSWORD:-change-me-db-password}"; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		"$(MIGRATE_DOCKER_IMAGE)" \
		-path /workspace/services/payment-service/migrations \
		-database "postgres://$$POSTGRES_USER:$$POSTGRES_PASSWORD@postgres:5432/ecommerce_payment?sslmode=disable" down -all; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		"$(MIGRATE_DOCKER_IMAGE)" \
		-path /workspace/services/order-service/migrations \
		-database "postgres://$$POSTGRES_USER:$$POSTGRES_PASSWORD@postgres:5432/ecommerce_order?sslmode=disable" down -all; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		"$(MIGRATE_DOCKER_IMAGE)" \
		-path /workspace/services/product-service/migrations \
		-database "postgres://$$POSTGRES_USER:$$POSTGRES_PASSWORD@postgres:5432/ecommerce_product?sslmode=disable" down -all; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		"$(MIGRATE_DOCKER_IMAGE)" \
		-path /workspace/services/user-service/migrations \
		-database "postgres://$$POSTGRES_USER:$$POSTGRES_PASSWORD@postgres:5432/ecommerce_user?sslmode=disable" down -all

migrate-force:
	@echo "==> Forcing migration versions to 1"
	@POSTGRES_USER="$$(grep -E '^POSTGRES_USER=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_PASSWORD="$$(grep -E '^POSTGRES_PASSWORD=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_USER="$${POSTGRES_USER:-admin}"; \
	POSTGRES_PASSWORD="$${POSTGRES_PASSWORD:-change-me-db-password}"; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		"$(MIGRATE_DOCKER_IMAGE)" \
		-path /workspace/services/user-service/migrations \
		-database "postgres://$$POSTGRES_USER:$$POSTGRES_PASSWORD@postgres:5432/ecommerce_user?sslmode=disable" force 1; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		"$(MIGRATE_DOCKER_IMAGE)" \
		-path /workspace/services/product-service/migrations \
		-database "postgres://$$POSTGRES_USER:$$POSTGRES_PASSWORD@postgres:5432/ecommerce_product?sslmode=disable" force 1; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		"$(MIGRATE_DOCKER_IMAGE)" \
		-path /workspace/services/order-service/migrations \
		-database "postgres://$$POSTGRES_USER:$$POSTGRES_PASSWORD@postgres:5432/ecommerce_order?sslmode=disable" force 1; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace \
		"$(MIGRATE_DOCKER_IMAGE)" \
		-path /workspace/services/payment-service/migrations \
		-database "postgres://$$POSTGRES_USER:$$POSTGRES_PASSWORD@postgres:5432/ecommerce_payment?sslmode=disable" force 1

storefront-import-dry-run:
	@echo "==> Dry-run importing storefront workbook into product-service"
	@POSTGRES_USER="$$(grep -E '^POSTGRES_USER=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_PASSWORD="$$(grep -E '^POSTGRES_PASSWORD=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_USER="$${POSTGRES_USER:-admin}"; \
	POSTGRES_PASSWORD="$${POSTGRES_PASSWORD:-change-me-db-password}"; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace/services/product-service \
		-e CONFIG_PATH="$(PRODUCT_CONFIG_CONTAINER)" \
		-e DATABASE_HOST="postgres" \
		-e DATABASE_PORT="5432" \
		-e DATABASE_USER="$$POSTGRES_USER" \
		-e DATABASE_PASSWORD="$$POSTGRES_PASSWORD" \
		-e DATABASE_DBNAME="ecommerce_product" \
		-e DATABASE_SSLMODE="disable" \
		"$(GO_DOCKER_IMAGE)" \
		sh -lc 'export PATH=/usr/local/go/bin:$$PATH; go run ./cmd/catalog-importer -workbook "$(CATALOG_WORKBOOK_CONTAINER)" -mode dry-run'

storefront-import-sample:
	@echo "==> Importing sample storefront workbook into product-service"
	@POSTGRES_USER="$$(grep -E '^POSTGRES_USER=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_PASSWORD="$$(grep -E '^POSTGRES_PASSWORD=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_USER="$${POSTGRES_USER:-admin}"; \
	POSTGRES_PASSWORD="$${POSTGRES_PASSWORD:-change-me-db-password}"; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-w /workspace/services/product-service \
		-e CONFIG_PATH="$(PRODUCT_CONFIG_CONTAINER)" \
		-e DATABASE_HOST="postgres" \
		-e DATABASE_PORT="5432" \
		-e DATABASE_USER="$$POSTGRES_USER" \
		-e DATABASE_PASSWORD="$$POSTGRES_PASSWORD" \
		-e DATABASE_DBNAME="ecommerce_product" \
		-e DATABASE_SSLMODE="disable" \
		"$(GO_DOCKER_IMAGE)" \
		sh -lc 'export PATH=/usr/local/go/bin:$$PATH; go run ./cmd/catalog-importer -workbook "$(CATALOG_WORKBOOK_CONTAINER)" -mode commit'

storefront-reset-sample:
	@echo "==> Repairing product-service storefront schema, rebuilding service, and re-importing sample workbook"
	@POSTGRES_USER="$$(grep -E '^POSTGRES_USER=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_PASSWORD="$$(grep -E '^POSTGRES_PASSWORD=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_USER="$${POSTGRES_USER:-admin}"; \
	POSTGRES_PASSWORD="$${POSTGRES_PASSWORD:-change-me-db-password}"; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-e PGPASSWORD="$$POSTGRES_PASSWORD" \
		"$(POSTGRES_CLIENT_IMAGE)" \
		psql -v ON_ERROR_STOP=1 -h postgres -U "$$POSTGRES_USER" -d ecommerce_product -f "$(STOREFRONT_RESET_SQL)"
	@cd "$(COMPOSE_DIR)" && DOCKER_BUILDKIT="$(DOCKER_BUILDKIT)" COMPOSE_DOCKER_CLI_BUILD="$(COMPOSE_DOCKER_CLI_BUILD)" \
		docker compose --env-file "$(COMPOSE_ENV_FILE)" up -d --build product-service api-gateway
	@$(MAKE) storefront-import-sample

storefront-explain-home:
	@echo "==> Running EXPLAIN ANALYZE for storefront/home queries"
	@POSTGRES_USER="$$(grep -E '^POSTGRES_USER=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_PASSWORD="$$(grep -E '^POSTGRES_PASSWORD=' "$(COMPOSE_ENV_FILE)" | tail -1 | cut -d= -f2-)"; \
	POSTGRES_USER="$${POSTGRES_USER:-admin}"; \
	POSTGRES_PASSWORD="$${POSTGRES_PASSWORD:-change-me-db-password}"; \
	docker run --rm --network "$(COMPOSE_NETWORK)" \
		-v "$(CURDIR):/workspace" \
		-e PGPASSWORD="$$POSTGRES_PASSWORD" \
		"$(POSTGRES_CLIENT_IMAGE)" \
		psql -v ON_ERROR_STOP=1 -h postgres -U "$$POSTGRES_USER" -d ecommerce_product -f "$(STOREFRONT_EXPLAIN_SQL)"
