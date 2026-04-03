SHELL := /bin/bash

MODULES := pkg api-gateway proto services/user-service services/product-service services/cart-service services/order-service services/payment-service services/notification-service
DOCKER_BUILDKIT ?= 1
COMPOSE_DOCKER_CLI_BUILD ?= 1
COMPOSE_DIR := deployments/docker
COMPOSE_ENV_FILE ?= $(if $(wildcard $(CURDIR)/.env.local),$(CURDIR)/.env.local,$(CURDIR)/.env.example)
COMPOSE_PROFILE_ARGS := $(if $(strip $(COMPOSE_PROFILES)),--profile $(COMPOSE_PROFILES),)
SERVICES ?=

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

.PHONY: fmt tidy test vet ci docker-config compose-build compose-up compose-down frontend-install frontend-dev frontend-build client-install client-dev client-build client-start k8s-apply k8s-delete migrate-up migrate-down migrate-force

fmt:
	@find api-gateway services pkg proto -name '*.go' -print0 | xargs -0 gofmt -w

tidy:
	@for module in $(MODULES); do \
		echo "==> go mod tidy $$module"; \
		(cd $$module && go mod tidy); \
	done

test:
	@for module in $(MODULES); do \
		echo "==> go test $$module"; \
		(cd $$module && go test ./...); \
	done

vet:
	@for module in $(MODULES); do \
		echo "==> go vet $$module"; \
		(cd $$module && go vet ./...); \
	done

ci: fmt tidy vet test

docker-config:
	@cd $(COMPOSE_DIR) && DOCKER_BUILDKIT=$(DOCKER_BUILDKIT) COMPOSE_DOCKER_CLI_BUILD=$(COMPOSE_DOCKER_CLI_BUILD) docker compose --env-file $(COMPOSE_ENV_FILE) $(COMPOSE_PROFILE_ARGS) config >/tmp/ecommerce-compose.rendered.yaml && echo "Rendered compose saved to /tmp/ecommerce-compose.rendered.yaml"

compose-build:
	@cd $(COMPOSE_DIR) && DOCKER_BUILDKIT=$(DOCKER_BUILDKIT) COMPOSE_DOCKER_CLI_BUILD=$(COMPOSE_DOCKER_CLI_BUILD) docker compose --env-file $(COMPOSE_ENV_FILE) $(COMPOSE_PROFILE_ARGS) build --progress plain $(SERVICES)

compose-up:
	@cd $(COMPOSE_DIR) && DOCKER_BUILDKIT=$(DOCKER_BUILDKIT) COMPOSE_DOCKER_CLI_BUILD=$(COMPOSE_DOCKER_CLI_BUILD) docker compose --env-file $(COMPOSE_ENV_FILE) $(COMPOSE_PROFILE_ARGS) up --build $(SERVICES)

compose-down:
	@cd $(COMPOSE_DIR) && DOCKER_BUILDKIT=$(DOCKER_BUILDKIT) COMPOSE_DOCKER_CLI_BUILD=$(COMPOSE_DOCKER_CLI_BUILD) docker compose --env-file $(COMPOSE_ENV_FILE) $(COMPOSE_PROFILE_ARGS) down

frontend-install:
	@cd frontend && npm install

frontend-dev:
	@cd frontend && npm run dev

frontend-build:
	@cd frontend && npm run build

client-install:
	@cd client && npm install

client-dev:
	@cd client && npm run dev

client-build:
	@cd client && npm run build

client-start:
	@cd client && npm run start

k8s-apply:
	kubectl apply -f deployments/k8s/

k8s-delete:
	kubectl delete -f deployments/k8s/ --ignore-not-found

migrate-up:
	@echo "==> Running migrations UP for all services"
	migrate -path services/user-service/migrations -database "$(USER_DB_URL)" up
	migrate -path services/product-service/migrations -database "$(PRODUCT_DB_URL)" up
	migrate -path services/order-service/migrations -database "$(ORDER_DB_URL)" up
	migrate -path services/payment-service/migrations -database "$(PAYMENT_DB_URL)" up

migrate-down:
	@echo "==> Running migrations DOWN for all services"
	migrate -path services/payment-service/migrations -database "$(PAYMENT_DB_URL)" down -all
	migrate -path services/order-service/migrations -database "$(ORDER_DB_URL)" down -all
	migrate -path services/product-service/migrations -database "$(PRODUCT_DB_URL)" down -all
	migrate -path services/user-service/migrations -database "$(USER_DB_URL)" down -all

migrate-force:
	@echo "==> Forcing migration versions to 1"
	migrate -path services/user-service/migrations -database "$(USER_DB_URL)" force 1
	migrate -path services/product-service/migrations -database "$(PRODUCT_DB_URL)" force 1
	migrate -path services/order-service/migrations -database "$(ORDER_DB_URL)" force 1
	migrate -path services/payment-service/migrations -database "$(PAYMENT_DB_URL)" force 1
