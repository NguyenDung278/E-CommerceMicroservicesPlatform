package grpc_client

import (
	"context"
	"fmt"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
)

type ProductClient struct {
	client pb.ProductServiceClient
	conn   *grpc.ClientConn
	log    *zap.Logger
}

func NewProductClient(target string, log *zap.Logger) (*ProductClient, error) {
	if log == nil {
		log = zap.NewNop()
	}

	conn, err := grpc.Dial(
		target,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithUnaryInterceptor(appobs.GRPCUnaryClientInterceptor("order-service")),
	)
	if err != nil {
		return nil, fmt.Errorf("did not connect: %v", err)
	}

	client := pb.NewProductServiceClient(conn)

	return &ProductClient{
		client: client,
		conn:   conn,
		log:    log,
	}, nil
}

func (c *ProductClient) Close() error {
	return c.conn.Close()
}

func (c *ProductClient) GetProduct(ctx context.Context, productID string) (*pb.Product, error) {
	req := &pb.GetProductByIDRequest{
		ProductId: productID,
	}

	res, err := c.client.GetProductByID(ctx, req)
	if err != nil {
		return nil, err
	}

	return res.Product, nil
}

// RestoreStock increments stock by reading the current product snapshot and then
// issuing a gRPC UpdateProduct call with the adjusted stock quantity.
//
// We intentionally reuse the existing proto contract here instead of adding a
// dedicated RestoreStock RPC to keep service coordination simple.
func (c *ProductClient) RestoreStock(ctx context.Context, productID string, quantity int) error {
	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(c.log, ctx,
		zap.String("product_id", productID),
		zap.Int("quantity", quantity),
	)
	defer func() {
		appobs.ObserveOperation("order-service", "stock_restore_grpc", appobs.OutcomeSuccess, time.Since(startedAt))
	}()

	product, err := c.GetProduct(ctx, productID)
	if err != nil {
		appobs.ObserveOperation("order-service", "stock_restore_grpc", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("failed to fetch product snapshot before stock restore", zap.Error(err))
		return fmt.Errorf("failed to get product for stock restore: %w", err)
	}

	newStock := product.StockQuantity + int32(quantity)
	_, err = c.client.UpdateProduct(ctx, &pb.UpdateProductRequest{
		ProductId:     productID,
		Name:          product.Name,
		Description:   product.Description,
		Price:         product.Price,
		Category:      product.Category,
		StockQuantity: newStock,
		ImageUrl:      product.ImageUrl,
	})
	if err != nil {
		appobs.ObserveOperation("order-service", "stock_restore_grpc", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("failed to restore stock via product-service gRPC",
			zap.Int32("previous_stock", product.StockQuantity),
			zap.Int32("new_stock", newStock),
			zap.Error(err),
		)
		return fmt.Errorf("failed to restore stock for product %s: %w", productID, err)
	}

	requestLog.Info("restored stock via product-service gRPC",
		zap.Int32("previous_stock", product.StockQuantity),
		zap.Int32("new_stock", newStock),
	)

	return nil
}
