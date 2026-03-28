package grpc

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/proto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

// UserGRPCServer implements the UserService gRPC interface
type UserGRPCServer struct {
	pb.UnimplementedUserServiceServer
	userService *service.UserService
}

// NewUserGRPCServer creates a new gRPC server for user service
func NewUserGRPCServer(userService *service.UserService) *UserGRPCServer {
	return &UserGRPCServer{
		userService: userService,
	}
}

// Register handles user registration via gRPC
//
// Mục đích: Cho phép các Microservices khác tạo tài khoản User thông qua gRPC (thay vì HTTP).
// Hiện tại API Gateway gọi HTTP trực tiếp tới Handler, nhưng hàm gRPC này dự phòng cho các Service backend gọi nội bộ.
func (s *UserGRPCServer) Register(ctx context.Context, req *pb.RegisterRequest) (*pb.RegisterResponse, error) {
	// Convert protobuf request to DTO
	registerReq := dto.RegisterRequest{
		Email:     req.GetEmail(),
		Password:  req.GetPassword(),
		FirstName: req.GetFirstName(),
		LastName:  req.GetLastName(),
	}

	// Call service layer
	authResponse, err := s.userService.Register(ctx, registerReq)
	if err != nil {
		// Map service errors to gRPC status codes
		switch err {
		case service.ErrEmailAlreadyExists:
			return nil, status.Error(codes.AlreadyExists, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	// Convert response to protobuf - handle interface{} type
	user := authResponse.User.(*model.User)
	return &pb.RegisterResponse{
		Token: authResponse.Token,
		User: &pb.User{
			Id:        user.ID,
			Email:     user.Email,
			FirstName: user.FirstName,
			LastName:  user.LastName,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z"),
			UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		},
	}, nil
}

// Login handles user login via gRPC
func (s *UserGRPCServer) Login(ctx context.Context, req *pb.LoginRequest) (*pb.LoginResponse, error) {
	// Convert protobuf request to DTO
	loginReq := dto.LoginRequest{
		Email:    req.GetEmail(),
		Password: req.GetPassword(),
	}

	// Call service layer
	authResponse, err := s.userService.Login(ctx, loginReq)
	if err != nil {
		// Map service errors to gRPC status codes
		switch err {
		case service.ErrUserNotFound, service.ErrInvalidCredentials:
			return nil, status.Error(codes.Unauthenticated, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	// Convert response to protobuf
	user := authResponse.User.(*model.User)
	return &pb.LoginResponse{
		Token: authResponse.Token,
		User: &pb.User{
			Id:        user.ID,
			Email:     user.Email,
			FirstName: user.FirstName,
			LastName:  user.LastName,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z"),
			UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		},
	}, nil
}

// GetProfile handles getting user profile via gRPC
func (s *UserGRPCServer) GetProfile(ctx context.Context, req *pb.GetProfileRequest) (*pb.GetProfileResponse, error) {
	// Get user ID from context (extracted from JWT by interceptor)
	userID, ok := ctx.Value("userID").(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user ID not found in context")
	}

	// Call service layer
	user, err := s.userService.GetProfile(ctx, userID)
	if err != nil {
		switch err {
		case service.ErrUserNotFound:
			return nil, status.Error(codes.NotFound, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	// Convert response to protobuf
	return &pb.GetProfileResponse{
		User: &pb.User{
			Id:        user.ID,
			Email:     user.Email,
			FirstName: user.FirstName,
			LastName:  user.LastName,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z"),
			UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		},
	}, nil
}

// UpdateProfile handles updating user profile via gRPC
func (s *UserGRPCServer) UpdateProfile(ctx context.Context, req *pb.UpdateProfileRequest) (*pb.UpdateProfileResponse, error) {
	// Get user ID from context (extracted from JWT by interceptor)
	userID, ok := ctx.Value("userID").(string)
	if !ok || userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user ID not found in context")
	}

	// Convert protobuf request to DTO
	updateReq := dto.UpdateProfileRequest{
		FirstName: optionalStringPointer(req.GetFirstName()),
		LastName:  optionalStringPointer(req.GetLastName()),
	}

	// Call service layer
	user, err := s.userService.UpdateProfile(ctx, userID, updateReq)
	if err != nil {
		switch err {
		case service.ErrUserNotFound:
			return nil, status.Error(codes.NotFound, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	// Convert response to protobuf
	return &pb.UpdateProfileResponse{
		User: &pb.User{
			Id:        user.ID,
			Email:     user.Email,
			FirstName: user.FirstName,
			LastName:  user.LastName,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z"),
			UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		},
	}, nil
}

func optionalStringPointer(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

// GetUserByID handles getting user by ID via gRPC
//
// Mục đích: Cung cấp thông tin User cho các Service khác (như Order Service).
// Ví dụ: Order Service cần biết Email của User để lưu vào hóa đơn thì sẽ gọi gRPC hàm này.
func (s *UserGRPCServer) GetUserByID(ctx context.Context, req *pb.GetUserByIDRequest) (*pb.GetUserByIDResponse, error) {
	userID := req.GetUserId()
	if userID == "" {
		return nil, status.Error(codes.InvalidArgument, "user ID is required")
	}

	// Call service layer
	user, err := s.userService.GetProfile(ctx, userID)
	if err != nil {
		switch err {
		case service.ErrUserNotFound:
			return nil, status.Error(codes.NotFound, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	// Convert response to protobuf
	return &pb.GetUserByIDResponse{
		User: &pb.User{
			Id:        user.ID,
			Email:     user.Email,
			FirstName: user.FirstName,
			LastName:  user.LastName,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.Format("2006-01-02T15:04:05Z"),
			UpdatedAt: user.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		},
	}, nil
}
