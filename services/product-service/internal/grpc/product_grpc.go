package grpc

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
)

type ProductGRPCServer struct {
	pb.UnimplementedProductServiceServer
	productService *service.ProductService
}

func NewProductGRPCServer(productService *service.ProductService) *ProductGRPCServer {
	return &ProductGRPCServer{productService: productService}
}

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
		Product: &pb.Product{
			Id:            product.ID,
			Name:          product.Name,
			Description:   product.Description,
			Price:         float32(product.Price),
			Category:      product.Category,
			StockQuantity: int32(product.Stock),
			ImageUrl:      product.ImageURL,
			CreatedAt:     product.CreatedAt.Format("2006-01-02T15:04:05Z"),
			UpdatedAt:     product.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		},
	}, nil
}
