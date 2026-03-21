package jobs

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
)

type LowStockMonitor struct {
	productService *service.ProductService
	log            *zap.Logger
	interval       time.Duration
	threshold      int
}

func NewLowStockMonitor(
	productService *service.ProductService,
	log *zap.Logger,
	interval time.Duration,
	threshold int,
) *LowStockMonitor {
	return &LowStockMonitor{
		productService: productService,
		log:            log,
		interval:       interval,
		threshold:      threshold,
	}
}

func (m *LowStockMonitor) Start(ctx context.Context) {
	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	m.runOnce(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.runOnce(ctx)
		}
	}
}

func (m *LowStockMonitor) runOnce(ctx context.Context) {
	products, err := m.productService.ListLowStock(ctx, m.threshold)
	if err != nil {
		m.log.Warn("low stock monitor failed", zap.Error(err))
		return
	}
	if len(products) == 0 {
		m.log.Debug("low stock monitor found no products below threshold", zap.Int("threshold", m.threshold))
		return
	}

	limit := len(products)
	if limit > 5 {
		limit = 5
	}
	names := make([]string, 0, limit)
	for index, product := range products {
		if index >= 5 {
			break
		}
		names = append(names, fmt.Sprintf("%s(%d)", product.Name, product.Stock))
	}

	m.log.Warn("low stock products detected",
		zap.Int("threshold", m.threshold),
		zap.Int("count", len(products)),
		zap.Strings("sample_products", names),
	)
}
