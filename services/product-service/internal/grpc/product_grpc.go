package grpc

import (
	"context"
	"errors"
	"time"

	appobs "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/observability"
	"go.uber.org/zap"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
)

type ProductGRPCServer struct {
	pb.UnimplementedProductServiceServer
	productService *service.ProductService
	log            *zap.Logger
}

func NewProductGRPCServer(productService *service.ProductService, log *zap.Logger) *ProductGRPCServer {
	if log == nil {
		log = zap.NewNop()
	}

	return &ProductGRPCServer{productService: productService, log: log}
}

// GetProductByID cung cấp thông tin sản phẩm qua gRPC.
//
// Trọng tâm nghiệp vụ: Order Service sẽ gọi hàm này để kiểm tra xem sản phẩm có tồn tại và còn đủ Stock không trước khi tạo Đơn.
func (s *ProductGRPCServer) GetProductByID(ctx context.Context, req *pb.GetProductByIDRequest) (*pb.GetProductByIDResponse, error) {
	productID := req.GetProductId()
	if productID == "" {
		return nil, status.Error(codes.InvalidArgument, "product_id is required")
	}

	product, err := s.productService.GetByID(ctx, productID)
	if err != nil {
		if err == service.ErrProductNotFound {
			return nil, status.Error(codes.NotFound, "product not found")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &pb.GetProductByIDResponse{
		Product: toProtoProduct(product),
	}, nil
}

// UpdateProduct cập nhật thông tin sản phẩm thông qua gRPC.
//
// Trọng tâm nghiệp vụ: Order Service có thể dùng hàm này như một mẹo (Hack/Reuse) để Restore lại Stock
// kho hàng khi 1 Đơn bị hủy (CancelOrder), tránh việc phải viết thêm RPC `RestoreStock` trong Protobuf.
func (s *ProductGRPCServer) UpdateProduct(ctx context.Context, req *pb.UpdateProductRequest) (*pb.UpdateProductResponse, error) {
	startedAt := time.Now()
	productID := req.GetProductId()
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("rpc.method", "UpdateProduct"),
		zap.String("product_id", productID),
		zap.Int("requested_stock", int(req.GetStockQuantity())),
	)

	defer func() {
		appobs.ObserveOperation("product-service", "grpc_update_product", appobs.OutcomeSuccess, time.Since(startedAt))
	}()

	if productID == "" {
		appobs.ObserveOperation("product-service", "grpc_update_product", appobs.OutcomeBusinessError, time.Since(startedAt))
		return nil, status.Error(codes.InvalidArgument, "product_id is required")
	}

	if isStockDeltaOnlyRequest(req) {
		return s.updateProductStockDelta(ctx, req, requestLog, startedAt)
	}

	existing, existingErr := s.productService.GetByID(ctx, productID)
	if existingErr != nil && existingErr != service.ErrProductNotFound {
		requestLog.Warn("failed to load existing product snapshot for observability", zap.Error(existingErr))
	}

	name := req.GetName()
	description := req.GetDescription()
	price := float64(req.GetPrice())
	category := req.GetCategory()
	stock := int(req.GetStockQuantity())
	imageURL := req.GetImageUrl()

	product, err := s.productService.Update(ctx, productID, dto.UpdateProductRequest{
		Name:        &name,
		Description: &description,
		Price:       &price,
		Category:    &category,
		Stock:       &stock,
		ImageURL:    &imageURL,
	})
	if err != nil {
		outcome := appobs.OutcomeFromError(err, service.ErrProductNotFound, service.ErrInvalidStatus)
		appobs.ObserveOperation("product-service", "grpc_update_product", outcome, time.Since(startedAt))
		if err == service.ErrProductNotFound {
			requestLog.Warn("grpc product update failed: product not found", zap.Error(err))
			return nil, status.Error(codes.NotFound, "product not found")
		}
		if err == service.ErrInvalidStatus {
			requestLog.Warn("grpc product update failed: invalid status", zap.Error(err))
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		requestLog.Error("grpc product update failed", zap.Error(err))
		return nil, status.Error(codes.Internal, err.Error())
	}

	if existing != nil && existing.Stock != product.Stock {
		appobs.IncEvent("product-service", "stock_update_attempt", appobs.OutcomeSuccess)
		requestLog.Info("product stock updated via gRPC",
			zap.Int("previous_stock", existing.Stock),
			zap.Int("current_stock", product.Stock),
			zap.Int("stock_delta", product.Stock-existing.Stock),
		)
	} else {
		requestLog.Info("product updated via gRPC", zap.Float64("price", product.Price))
	}

	return &pb.UpdateProductResponse{
		Product: toProtoProduct(product),
	}, nil
}

func isStockDeltaOnlyRequest(req *pb.UpdateProductRequest) bool {
	return req.GetName() == "" &&
		req.GetDescription() == "" &&
		req.GetCategory() == "" &&
		req.GetImageUrl() == "" &&
		req.GetPrice() == 0
}

func (s *ProductGRPCServer) updateProductStockDelta(
	ctx context.Context,
	req *pb.UpdateProductRequest,
	requestLog *zap.Logger,
	startedAt time.Time,
) (*pb.UpdateProductResponse, error) {
	productID := req.GetProductId()
	delta := int(req.GetStockQuantity())
	if delta == 0 {
		appobs.ObserveOperation("product-service", "grpc_update_product", appobs.OutcomeBusinessError, time.Since(startedAt))
		return nil, status.Error(codes.InvalidArgument, "stock delta must be non-zero")
	}

	previous, previousErr := s.productService.GetByID(ctx, productID)
	if previousErr != nil {
		outcome := appobs.OutcomeFromError(previousErr, service.ErrProductNotFound)
		appobs.ObserveOperation("product-service", "grpc_update_product", outcome, time.Since(startedAt))
		if previousErr == service.ErrProductNotFound {
			requestLog.Warn("grpc stock delta failed: product not found", zap.Error(previousErr))
			return nil, status.Error(codes.NotFound, "product not found")
		}
		requestLog.Error("grpc stock delta failed while loading product", zap.Error(previousErr))
		return nil, status.Error(codes.Internal, previousErr.Error())
	}

	var err error
	if delta > 0 {
		err = s.productService.DecreaseStock(ctx, productID, delta)
	} else {
		err = s.productService.RestoreStock(ctx, productID, -delta)
	}
	if err != nil {
		outcome := appobs.OutcomeFromError(err, service.ErrProductNotFound, service.ErrInsufficientStock)
		appobs.ObserveOperation("product-service", "grpc_update_product", outcome, time.Since(startedAt))
		switch err {
		case service.ErrProductNotFound:
			requestLog.Warn("grpc stock delta failed: product not found", zap.Error(err))
			return nil, status.Error(codes.NotFound, "product not found")
		case service.ErrInsufficientStock:
			requestLog.Warn("grpc stock delta failed: insufficient stock",
				zap.Int("requested_delta", delta),
				zap.Int("previous_stock", previous.Stock),
				zap.Error(err),
			)
			return nil, status.Error(codes.FailedPrecondition, "insufficient stock")
		default:
			requestLog.Error("grpc stock delta failed",
				zap.Int("requested_delta", delta),
				zap.Int("previous_stock", previous.Stock),
				zap.Error(err),
			)
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	product, reloadErr := s.productService.GetByID(ctx, productID)
	if reloadErr != nil {
		appobs.ObserveOperation("product-service", "grpc_update_product", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("grpc stock delta updated inventory but failed to reload product", zap.Error(reloadErr))
		return nil, status.Error(codes.Internal, reloadErr.Error())
	}

	requestLog.Info("product stock adjusted via gRPC",
		zap.Int("previous_stock", previous.Stock),
		zap.Int("current_stock", product.Stock),
		zap.Int("stock_delta", delta),
	)

	return &pb.UpdateProductResponse{
		Product: toProtoProduct(product),
	}, nil
}

// ReserveStock giữ chỗ tồn kho cho toàn bộ item của một order trong một
// transaction: hoặc trừ đủ mọi item, hoặc không trừ gì. order_id là idempotency
// key nên order-service retry an toàn.
func (s *ProductGRPCServer) ReserveStock(ctx context.Context, req *pb.ReserveStockRequest) (*pb.ReserveStockResponse, error) {
	startedAt := time.Now()
	orderID := req.GetOrderId()
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("rpc.method", "ReserveStock"),
		zap.String("order_id", orderID),
		zap.Int("item_count", len(req.GetItems())),
	)

	items := make([]model.StockReservationItem, 0, len(req.GetItems()))
	for _, item := range req.GetItems() {
		items = append(items, model.StockReservationItem{
			ProductID: item.GetProductId(),
			SKU:       item.GetSku(),
			Quantity:  int(item.GetQuantity()),
		})
	}

	replayed, err := s.productService.ReserveStockForOrder(ctx, orderID, items)
	if err != nil {
		outcome := appobs.OutcomeFromError(err, service.ErrProductNotFound, service.ErrInsufficientStock)
		appobs.ObserveOperation("product-service", "grpc_reserve_stock", outcome, time.Since(startedAt))
		switch {
		case errors.Is(err, service.ErrReservationOrderRequired),
			errors.Is(err, service.ErrReservationItemsRequired),
			errors.Is(err, service.ErrReservationItemInvalid):
			requestLog.Warn("grpc stock reservation rejected", zap.Error(err))
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case errors.Is(err, service.ErrProductVariantRequired):
			requestLog.Warn("grpc stock reservation rejected: variant sku missing", zap.Error(err))
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case errors.Is(err, service.ErrProductNotFound):
			requestLog.Warn("grpc stock reservation failed: product not found", zap.Error(err))
			return nil, status.Error(codes.NotFound, "product not found")
		case errors.Is(err, service.ErrProductVariantNotFound):
			requestLog.Warn("grpc stock reservation failed: variant not found", zap.Error(err))
			return nil, status.Error(codes.NotFound, "product variant not found")
		case errors.Is(err, service.ErrInsufficientStock):
			requestLog.Warn("grpc stock reservation failed: insufficient stock", zap.Error(err))
			return nil, status.Error(codes.FailedPrecondition, "insufficient stock")
		default:
			requestLog.Error("grpc stock reservation failed", zap.Error(err))
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	appobs.ObserveOperation("product-service", "grpc_reserve_stock", appobs.OutcomeSuccess, time.Since(startedAt))
	requestLog.Info("stock reserved for order via gRPC", zap.Bool("already_reserved", replayed))
	return &pb.ReserveStockResponse{AlreadyReserved: replayed}, nil
}

// ReleaseStock trả tồn kho đã giữ của một order về kho. Idempotent: release
// lần hai hoặc release một order không có reservation là no-op thành công.
func (s *ProductGRPCServer) ReleaseStock(ctx context.Context, req *pb.ReleaseStockRequest) (*pb.ReleaseStockResponse, error) {
	startedAt := time.Now()
	orderID := req.GetOrderId()
	requestLog := appobs.LoggerWithContext(s.log, ctx,
		zap.String("rpc.method", "ReleaseStock"),
		zap.String("order_id", orderID),
	)

	released, err := s.productService.ReleaseStockForOrder(ctx, orderID)
	if err != nil {
		if errors.Is(err, service.ErrReservationOrderRequired) {
			appobs.ObserveOperation("product-service", "grpc_release_stock", appobs.OutcomeBusinessError, time.Since(startedAt))
			requestLog.Warn("grpc stock release rejected", zap.Error(err))
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		appobs.ObserveOperation("product-service", "grpc_release_stock", appobs.OutcomeSystemError, time.Since(startedAt))
		requestLog.Error("grpc stock release failed", zap.Error(err))
		return nil, status.Error(codes.Internal, err.Error())
	}

	appobs.ObserveOperation("product-service", "grpc_release_stock", appobs.OutcomeSuccess, time.Since(startedAt))
	requestLog.Info("stock released for order via gRPC", zap.Int("released_items", released))
	return &pb.ReleaseStockResponse{ReleasedItems: int32(released)}, nil
}

func toProtoProduct(product *model.Product) *pb.Product {
	// The current proto contract models price/time as float/string, so the gRPC
	// adapter normalizes domain values into that transport shape here.
	return &pb.Product{
		Id:            product.ID,
		Name:          product.Name,
		Description:   product.Description,
		Price:         float32(product.Price),
		Category:      product.Category,
		StockQuantity: int32(product.Stock),
		ImageUrl:      product.ImageURL,
		CreatedAt:     product.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:     product.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		Variants:      toProtoVariants(product.Variants),
	}
}

// toProtoVariants exposes per-variant price and stock over gRPC so cart-service
// and order-service can price and stock-check the exact sku a shopper picked
// instead of falling back to the product-level aggregate.
func toProtoVariants(variants []model.ProductVariant) []*pb.ProductVariant {
	if len(variants) == 0 {
		return nil
	}

	protoVariants := make([]*pb.ProductVariant, 0, len(variants))
	for _, variant := range variants {
		protoVariants = append(protoVariants, &pb.ProductVariant{
			Sku:   variant.SKU,
			Label: variant.Label,
			Size:  variant.Size,
			Color: variant.Color,
			Price: float32(variant.Price),
			Stock: int32(variant.Stock),
		})
	}
	return protoVariants
}
