package handler

import (
	orderhandler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/handler/order"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/service"
)

type OrderHandler = orderhandler.OrderHandler

func NewOrderHandler(orderService *service.OrderService) *OrderHandler {
	return orderhandler.NewOrderHandler(orderService)
}
