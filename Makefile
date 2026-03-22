SHELL := /bin/bash

MODULES := pkg api-gateway proto services/user-service services/product-service services/cart-service services/order-service services/payment-service services/notification-service

# Database connection details for migrations
DB_URL ?= postgres://admin:change-me-db-password@localhost:5432/ecommerce?sslmode=disable

.PHONY: fmt tidy test vet ci docker-config compose-up compose-down frontend-install frontend-dev frontend-build k8s-apply k8s-delete migrate-up migrate-down migrate-force

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
	@cd deployments/docker && docker compose config >/tmp/ecommerce-compose.rendered.yaml && echo "Rendered compose saved to /tmp/ecommerce-compose.rendered.yaml"

compose-up:
	@cd deployments/docker && docker compose up --build -d

compose-down:
	@cd deployments/docker && docker compose down

frontend-install:
	@cd frontend && npm install

frontend-dev:
	@cd frontend && npm run dev

frontend-build:
	@cd frontend && npm run build

k8s-apply:
	kubectl apply -f deployments/k8s/

k8s-delete:
	kubectl delete -f deployments/k8s/ --ignore-not-found

migrate-up:
	@echo "==> Running migrations UP for all services"
	migrate -path services/user-service/migrations -database "$(DB_URL)" up
	migrate -path services/product-service/migrations -database "$(DB_URL)" up
	migrate -path services/order-service/migrations -database "$(DB_URL)" up
	migrate -path services/payment-service/migrations -database "$(DB_URL)" up

migrate-down:
	@echo "==> Running migrations DOWN for all services"
	migrate -path services/payment-service/migrations -database "$(DB_URL)" down -all
	migrate -path services/order-service/migrations -database "$(DB_URL)" down -all
	migrate -path services/product-service/migrations -database "$(DB_URL)" down -all
	migrate -path services/user-service/migrations -database "$(DB_URL)" down -all

migrate-force:
	@echo "==> Forcing migration versions to 1"
	migrate -path services/user-service/migrations -database "$(DB_URL)" force 1
	migrate -path services/product-service/migrations -database "$(DB_URL)" force 1
	migrate -path services/order-service/migrations -database "$(DB_URL)" force 1
	migrate -path services/payment-service/migrations -database "$(DB_URL)" force 1
