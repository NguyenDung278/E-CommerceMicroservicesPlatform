package grpc

import (
	"context"
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
	}
}
