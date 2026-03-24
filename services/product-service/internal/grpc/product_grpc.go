package grpc

import (
	"context"

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
}

func NewProductGRPCServer(productService *service.ProductService) *ProductGRPCServer {
	return &ProductGRPCServer{productService: productService}
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
	productID := req.GetProductId()
	if productID == "" {
		return nil, status.Error(codes.InvalidArgument, "product_id is required")
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
		if err == service.ErrProductNotFound {
			return nil, status.Error(codes.NotFound, "product not found")
		}
		if err == service.ErrInvalidStatus {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &pb.UpdateProductResponse{
		Product: toProtoProduct(product),
	}, nil
}

func toProtoProduct(product *model.Product) *pb.Product {
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
