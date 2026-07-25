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
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
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

// ReserveOrderStock reserves stock for every item of one order through the
// all-or-nothing ReserveStock RPC. order_id is the idempotency key, so retries
// after a network failure are safe; already_reserved marks such replays.
func (c *ProductClient) ReserveOrderStock(ctx context.Context, orderID string, items []model.OrderItem) (bool, error) {
	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(c.log, ctx,
		zap.String("order_id", orderID),
		zap.Int("item_count", len(items)),
	)

	reservationItems := make([]*pb.StockReservationItem, 0, len(items))
	for _, item := range items {
		reservationItems = append(reservationItems, &pb.StockReservationItem{
			ProductId: item.ProductID,
			Quantity:  int32(item.Quantity),
		})
	}

	res, err := c.client.ReserveStock(ctx, &pb.ReserveStockRequest{
		OrderId: orderID,
		Items:   reservationItems,
	})
	if err != nil {
		appobs.ObserveOperation("order-service", "stock_reserve_grpc", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Warn("failed to reserve stock via product-service gRPC", zap.Error(err))
		return false, fmt.Errorf("failed to reserve stock for order %s: %w", orderID, err)
	}

	appobs.ObserveOperation("order-service", "stock_reserve_grpc", appobs.OutcomeSuccess, time.Since(startedAt))
	requestLog.Info("reserved stock via product-service gRPC",
		zap.Bool("already_reserved", res.GetAlreadyReserved()),
	)
	return res.GetAlreadyReserved(), nil
}

// ReleaseOrderStock returns every still-held reservation of one order back into
// stock through the idempotent ReleaseStock RPC.
func (c *ProductClient) ReleaseOrderStock(ctx context.Context, orderID string) (int, error) {
	startedAt := time.Now()
	requestLog := appobs.LoggerWithContext(c.log, ctx, zap.String("order_id", orderID))

	res, err := c.client.ReleaseStock(ctx, &pb.ReleaseStockRequest{OrderId: orderID})
	if err != nil {
		appobs.ObserveOperation("order-service", "stock_release_grpc", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Warn("failed to release stock via product-service gRPC", zap.Error(err))
		return 0, fmt.Errorf("failed to release stock for order %s: %w", orderID, err)
	}

	appobs.ObserveOperation("order-service", "stock_release_grpc", appobs.OutcomeSuccess, time.Since(startedAt))
	requestLog.Info("released stock via product-service gRPC",
		zap.Int("released_items", int(res.GetReleasedItems())),
	)
	return int(res.GetReleasedItems()), nil
}
