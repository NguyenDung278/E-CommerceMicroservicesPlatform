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

// DecreaseStock atomically decrements stock through the existing UpdateProduct
// RPC using the service's stock-delta mode.
func (c *ProductClient) DecreaseStock(ctx context.Context, productID string, quantity int) error {
	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(c.log, ctx,
		zap.String("product_id", productID),
		zap.Int("quantity", quantity),
	)
	defer func() {
		appobs.ObserveOperation("order-service", "stock_decrease_grpc", appobs.OutcomeSuccess, time.Since(startedAt))
	}()

	if quantity <= 0 {
		return fmt.Errorf("quantity must be positive")
	}

	_, err := c.client.UpdateProduct(ctx, &pb.UpdateProductRequest{
		ProductId:     productID,
		StockQuantity: int32(quantity),
	})
	if err != nil {
		appobs.ObserveOperation("order-service", "stock_decrease_grpc", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("failed to decrease stock via product-service gRPC", zap.Error(err))
		return fmt.Errorf("failed to decrease stock for product %s: %w", productID, err)
	}

	requestLog.Info("decreased stock via product-service gRPC")

	return nil
}

// RestoreStock increments stock by using the product-service stock-delta mode
// exposed through the existing UpdateProduct RPC.
func (c *ProductClient) RestoreStock(ctx context.Context, productID string, quantity int) error {
	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(c.log, ctx,
		zap.String("product_id", productID),
		zap.Int("quantity", quantity),
	)
	defer func() {
		appobs.ObserveOperation("order-service", "stock_restore_grpc", appobs.OutcomeSuccess, time.Since(startedAt))
	}()

	if quantity <= 0 {
		return fmt.Errorf("quantity must be positive")
	}

	_, err := c.client.UpdateProduct(ctx, &pb.UpdateProductRequest{
		ProductId:     productID,
		StockQuantity: -int32(quantity),
	})
	if err != nil {
		appobs.ObserveOperation("order-service", "stock_restore_grpc", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("failed to restore stock via product-service gRPC", zap.Error(err))
		return fmt.Errorf("failed to restore stock for product %s: %w", productID, err)
	}

	requestLog.Info("restored stock via product-service gRPC")
	return nil
}
