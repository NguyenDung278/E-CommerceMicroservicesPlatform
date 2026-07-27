// Module học tập độc lập — KHÔNG nằm trong biến MODULES của Makefile gốc,
// nên `make ci` / `make test` của repo không đụng tới nó.
module github.com/NguyenDung278/E-CommerceMicroservicesPlatform/docs/learning/labs/redis-pubsub

go 1.25.0

require github.com/redis/go-redis/v9 v9.4.0

require (
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
)
