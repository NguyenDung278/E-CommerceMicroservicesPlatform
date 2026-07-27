.PHONY: up down pub sub xadd xread reset build tidy

up:            ## bật Redis riêng cho lab (cổng 6380)
	docker compose up -d
	@echo "✓ Redis lab sẵn sàng ở localhost:6380"

down:          ## tắt và xoá container lab
	docker compose down -v

build:
	go build ./...

tidy:
	go mod tidy

pub:           ## phát 5 thông điệp Pub/Sub (make pub N=10 để đổi số lượng)
	go run . pub $(or $(N),5)

sub:           ## lắng nghe Pub/Sub
	go run . sub

xadd:          ## ghi 5 thông điệp vào Stream
	go run . xadd $(or $(N),5)

xread:         ## đọc Stream bằng consumer group (make xread C=c2 để đổi consumer)
	go run . xread $(or $(G),g1) $(or $(C),c1)

reset:         ## xoá stream, chạy lại thí nghiệm từ đầu
	go run . reset
