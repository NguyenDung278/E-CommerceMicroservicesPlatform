package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
)

var (
	ErrAddressNotFound  = errors.New("address not found")
	ErrTooManyAddresses = errors.New("maximum number of addresses reached")
)

const maxAddressesPerUser = 10

// AddressService contains business logic for address operations.
type AddressService struct {
	repo repository.AddressRepository
}

func NewAddressService(repo repository.AddressRepository) *AddressService {
	return &AddressService{repo: repo}
}

// CreateAddress creates a new shipping address for a user.
// If this is the user's first address, it is automatically set as default.
func (s *AddressService) CreateAddress(ctx context.Context, userID string, req dto.CreateAddressRequest) (*model.Address, error) {
	count, err := s.repo.CountByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if count >= maxAddressesPerUser {
		return nil, ErrTooManyAddresses
	}

	// If this is the first address or explicitly set as default, clear existing defaults.
	isDefault := req.IsDefault || count == 0
	if isDefault {
		if err := s.repo.ClearDefault(ctx, userID); err != nil {
			return nil, err
		}
	}

	now := time.Now()
	addr := &model.Address{
		ID:            uuid.New().String(),
		UserID:        userID,
		RecipientName: req.RecipientName,
		Phone:         req.Phone,
		Street:        req.Street,
		Ward:          req.Ward,
		District:      req.District,
		City:          req.City,
		IsDefault:     isDefault,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := s.repo.Create(ctx, addr); err != nil {
		return nil, err
	}
	return addr, nil
}

// GetAddresses returns all addresses for a user.
func (s *AddressService) GetAddresses(ctx context.Context, userID string) ([]*model.Address, error) {
	return s.repo.GetByUserID(ctx, userID)
}

func (s *AddressService) GetDefaultAddress(ctx context.Context, userID string) (*model.Address, error) {
	addresses, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	for _, address := range addresses {
		if address.IsDefault {
			return address, nil
		}
	}
	if len(addresses) > 0 {
		return addresses[0], nil
	}
	return nil, nil
}

func (s *AddressService) UpsertDefaultAddress(ctx context.Context, userID string, input dto.ProfileAddressInput) (*model.Address, error) {
	defaultAddress, err := s.GetDefaultAddress(ctx, userID)
	if err != nil {
		return nil, err
	}

	if defaultAddress == nil {
		return s.CreateAddress(ctx, userID, dto.CreateAddressRequest{
			RecipientName: normalizeHumanName(input.RecipientName),
			Phone:         normalizePhone(input.Phone),
			Street:        strings.TrimSpace(input.Street),
			Ward:          strings.TrimSpace(input.Ward),
			District:      strings.TrimSpace(input.District),
			City:          strings.TrimSpace(input.City),
			IsDefault:     true,
		})
	}

	defaultAddress.RecipientName = normalizeHumanName(input.RecipientName)
	defaultAddress.Phone = normalizePhone(input.Phone)
	defaultAddress.Street = strings.TrimSpace(input.Street)
	defaultAddress.Ward = strings.TrimSpace(input.Ward)
	defaultAddress.District = strings.TrimSpace(input.District)
	defaultAddress.City = strings.TrimSpace(input.City)
	defaultAddress.IsDefault = true
	defaultAddress.UpdatedAt = time.Now()
	if err := s.repo.ClearDefault(ctx, userID); err != nil {
		return nil, err
	}
	if err := s.repo.Update(ctx, defaultAddress); err != nil {
		return nil, err
	}
	return defaultAddress, nil
}

// UpdateAddress updates an existing address. Only the owner can update.
func (s *AddressService) UpdateAddress(ctx context.Context, userID, addressID string, req dto.UpdateAddressRequest) (*model.Address, error) {
	addr, err := s.repo.GetByID(ctx, addressID)
	if err != nil {
		return nil, err
	}
	if addr == nil || addr.UserID != userID {
		return nil, ErrAddressNotFound
	}

	// Apply partial updates.
	if req.RecipientName != nil {
		addr.RecipientName = *req.RecipientName
	}
	if req.Phone != nil {
		addr.Phone = *req.Phone
	}
	if req.Street != nil {
		addr.Street = *req.Street
	}
	if req.Ward != nil {
		addr.Ward = *req.Ward
	}
	if req.District != nil {
		addr.District = *req.District
	}
	if req.City != nil {
		addr.City = *req.City
	}
	if req.IsDefault != nil && *req.IsDefault {
		if err := s.repo.ClearDefault(ctx, userID); err != nil {
			return nil, err
		}
		addr.IsDefault = true
	}
	addr.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, addr); err != nil {
		return nil, err
	}
	return addr, nil
}

// DeleteAddress removes an address. Only the owner can delete.
func (s *AddressService) DeleteAddress(ctx context.Context, userID, addressID string) error {
	addr, err := s.repo.GetByID(ctx, addressID)
	if err != nil {
		return err
	}
	if addr == nil || addr.UserID != userID {
		return ErrAddressNotFound
	}
	return s.repo.Delete(ctx, addressID)
}

// SetDefault marks an address as the default shipping address.
func (s *AddressService) SetDefault(ctx context.Context, userID, addressID string) (*model.Address, error) {
	addr, err := s.repo.GetByID(ctx, addressID)
	if err != nil {
		return nil, err
	}
	if addr == nil || addr.UserID != userID {
		return nil, ErrAddressNotFound
	}

	if err := s.repo.ClearDefault(ctx, userID); err != nil {
		return nil, err
	}

	addr.IsDefault = true
	addr.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, addr); err != nil {
		return nil, err
	}
	return addr, nil
}
