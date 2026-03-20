package grpc_client

import (
	"context"
	"fmt"

	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type ProductClient struct {
	client pb.ProductServiceClient
	conn   *grpc.ClientConn
}

func NewProductClient(target string) (*ProductClient, error) {
	conn, err := grpc.Dial(target, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("did not connect: %v", err)
	}

	return &ProductClient{
		client: pb.NewProductServiceClient(conn),
		conn:   conn,
	}, nil
}

func (c *ProductClient) Close() error {
	return c.conn.Close()
}

func (c *ProductClient) GetProduct(ctx context.Context, productID string) (*pb.Product, error) {
	res, err := c.client.GetProductByID(ctx, &pb.GetProductByIDRequest{ProductId: productID})
	if err != nil {
		return nil, err
	}

	return res.Product, nil
}
