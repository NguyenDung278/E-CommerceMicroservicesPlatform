package repository

import (
	"github.com/redis/go-redis/v9"

	cartrepo "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/cart-service/internal/repository/cart"
)

type CartRepository = cartrepo.CartRepository

func NewCartRepository(client *redis.Client) CartRepository {
	return cartrepo.NewCartRepository(client)
}
