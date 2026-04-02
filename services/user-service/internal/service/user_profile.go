package service

import (
	"context"
	"strings"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
)

// GetProfile returns the current user profile by id.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - userID identifies the authenticated user.
//
// Returns:
//   - the matching user profile.
//   - ErrUserNotFound when no user exists for the id.
//
// Edge cases:
//   - none beyond the standard not-found handling.
//
// Side effects:
//   - none.
//
// Performance:
//   - one repository lookup.
func (s *UserService) GetProfile(ctx context.Context, userID string) (*model.User, error) {
	return s.loadUserByID(ctx, s.repo, userID)
}

// UpdateProfile applies profile, phone, and default-address changes while
// keeping multi-repository updates transaction-safe when a transaction manager is available.
//
// Inputs:
//   - ctx carries cancellation to repository operations.
//   - userID identifies the authenticated user.
//   - req contains the optional profile patch.
//
// Returns:
//   - the updated user profile.
//   - a business or persistence error describing why the update failed.
//
// Edge cases:
//   - when no profile or address field changes are detected, the current user is returned unchanged.
//   - phone changes require a verified phone challenge and may consume that challenge.
//
// Side effects:
//   - may update the user row, default address, and phone verification challenge.
//
// Performance:
//   - dominated by repository lookups; an empty address patch now skips the address lookup entirely.
func (s *UserService) UpdateProfile(ctx context.Context, userID string, req dto.UpdateProfileRequest) (*model.User, error) {
	if s.profileTxManager == nil {
		return s.updateProfileWithDependencies(ctx, userID, req, s.repo, s.phoneVerificationRepo, s.addressService)
	}

	var updatedUser *model.User
	err := s.profileTxManager.RunInTx(ctx, func(repos repository.ProfileTxRepositories) error {
		addressService := s.addressService
		if repos.Addresses != nil {
			addressService = NewAddressService(repos.Addresses)
		}

		user, err := s.updateProfileWithDependencies(ctx, userID, req, repos.Users, repos.PhoneVerifications, addressService)
		if err != nil {
			return err
		}

		updatedUser = user
		return nil
	})
	if err != nil {
		return nil, err
	}

	return updatedUser, nil
}

// updateProfileWithDependencies contains the core profile-update workflow so it
// can run either transactionally or against direct dependencies in tests.
//
// Inputs:
//   - ctx carries cancellation to repository operations.
//   - userID identifies the target user.
//   - req contains the optional profile patch.
//   - userRepo, phoneRepo, and addressService provide the persistence dependencies.
//
// Returns:
//   - the updated user profile.
//   - a business or persistence error.
//
// Edge cases:
//   - empty `DefaultAddress` payloads are treated as no-ops and skip the address lookup.
//   - changing phone numbers requires a verified challenge tied to the same user.
//
// Side effects:
//   - may update the user row, the default address, and the phone challenge state.
//
// Performance:
//   - one user lookup plus only the minimum additional dependency calls needed for the requested fields.
func (s *UserService) updateProfileWithDependencies(
	ctx context.Context,
	userID string,
	req dto.UpdateProfileRequest,
	userRepo repository.UserRepository,
	phoneRepo repository.PhoneVerificationRepository,
	addressService *AddressService,
) (*model.User, error) {
	user, err := s.loadUserByID(ctx, userRepo, userID)
	if err != nil {
		return nil, err
	}
	profilePhoneForAddress := user.Phone

	userChanged := false
	if firstName, changed, err := resolveOptionalHumanNameUpdate(user.FirstName, req.FirstName, 100); err != nil {
		return nil, err
	} else if changed {
		user.FirstName = firstName
		userChanged = true
	}
	if lastName, changed, err := resolveOptionalHumanNameUpdate(user.LastName, req.LastName, 100); err != nil {
		return nil, err
	} else if changed {
		user.LastName = lastName
		userChanged = true
	}

	currentPhone := normalizePhone(user.Phone)
	requestedPhone, phoneProvided := resolveOptionalPhone(req.Phone)
	phoneChanged := phoneProvided && requestedPhone != currentPhone
	var verifiedChallenge *model.PhoneVerificationChallenge
	if phoneChanged {
		verifiedChallenge, err = s.applyVerifiedPhoneChange(ctx, userID, requestedPhone, req.PhoneVerificationID, user, userRepo, phoneRepo)
		if err != nil {
			return nil, err
		}
		userChanged = true
	}

	var (
		normalizedAddress *dto.ProfileAddressInput
		addressChanged    bool
	)
	if req.DefaultAddress != nil && addressService != nil && hasMeaningfulProfileAddressPatch(*req.DefaultAddress) {
		defaultAddress, err := addressService.GetDefaultAddress(ctx, userID)
		if err != nil {
			return nil, err
		}

		addressCopy, changed := mergeProfileAddressInput(defaultAddress, profilePhoneForAddress, *req.DefaultAddress)
		if changed {
			if !isValidProfileAddressInput(addressCopy) {
				return nil, ErrInvalidProfileAddress
			}
			normalizedAddress = &addressCopy
			addressChanged = true
		}
	}

	if !userChanged && !addressChanged {
		return user, nil
	}

	if normalizedAddress != nil && addressService != nil {
		if _, err := addressService.UpsertDefaultAddress(ctx, userID, *normalizedAddress); err != nil {
			return nil, err
		}
	}

	if userChanged {
		user.UpdatedAt = currentTime()
		if err := userRepo.Update(ctx, user); err != nil {
			return nil, mapUserRepositoryError(err)
		}
	}

	if verifiedChallenge != nil {
		now := currentTime()
		verifiedChallenge.Status = model.PhoneVerificationStatusConsumed
		verifiedChallenge.ConsumedAt = &now
		verifiedChallenge.UpdatedAt = now
		if err := phoneRepo.Update(ctx, verifiedChallenge); err != nil {
			return nil, err
		}
	}

	return user, nil
}

// applyVerifiedPhoneChange validates and applies a requested phone-number change
// against a verified phone challenge.
//
// Inputs:
//   - ctx carries cancellation to repository operations.
//   - userID identifies the target user.
//   - requestedPhone is the normalized target phone number.
//   - verificationID is the client-supplied verification challenge id.
//   - user is mutated in place on success.
//   - userRepo and phoneRepo provide the persistence dependencies.
//
// Returns:
//   - the verified challenge that must be consumed after the profile update commits.
//   - an error when validation fails.
//
// Edge cases:
//   - challenges must belong to the same user, be verified, and match the exact requested phone.
//
// Side effects:
//   - mutates the supplied user in memory on success.
//
// Performance:
//   - up to three repository lookups.
func (s *UserService) applyVerifiedPhoneChange(
	ctx context.Context,
	userID string,
	requestedPhone string,
	verificationID string,
	user *model.User,
	userRepo repository.UserRepository,
	phoneRepo repository.PhoneVerificationRepository,
) (*model.PhoneVerificationChallenge, error) {
	if !isValidVNPhone(requestedPhone) {
		return nil, ErrInvalidPhoneNumber
	}
	if strings.TrimSpace(verificationID) == "" || phoneRepo == nil {
		return nil, ErrPhoneVerificationRequired
	}

	existingUser, err := userRepo.GetByPhone(ctx, requestedPhone)
	if err != nil {
		return nil, err
	}
	if existingUser != nil && existingUser.ID != userID {
		return nil, ErrPhoneAlreadyExists
	}

	verifiedChallenge, err := phoneRepo.GetByID(ctx, strings.TrimSpace(verificationID))
	if err != nil {
		return nil, err
	}
	if verifiedChallenge == nil || verifiedChallenge.UserID != userID {
		return nil, ErrPhoneVerificationNotFound
	}
	if verifiedChallenge.Status == model.PhoneVerificationStatusConsumed || verifiedChallenge.ConsumedAt != nil {
		return nil, ErrPhoneVerificationAlreadyUsed
	}
	if verifiedChallenge.Status != model.PhoneVerificationStatusVerified || verifiedChallenge.VerifiedAt == nil {
		return nil, ErrPhoneVerificationRequired
	}
	if normalizePhone(verifiedChallenge.PhoneCandidate) != requestedPhone {
		return nil, ErrPhoneVerificationRequired
	}

	now := currentTime()
	user.Phone = requestedPhone
	user.PhoneVerified = true
	user.PhoneVerifiedAt = &now
	user.PhoneLastChangedAt = &now

	return verifiedChallenge, nil
}

// loadUserByID centralizes user not-found handling for user-facing profile and
// auth flows.
//
// Inputs:
//   - ctx carries cancellation to the repository.
//   - userRepo is the repository used for lookup.
//   - userID identifies the user to load.
//
// Returns:
//   - the matching user.
//   - ErrUserNotFound when no user exists for that id.
//
// Edge cases:
//   - repositories may return nil,nil for missing users and that is translated here.
//
// Side effects:
//   - none.
//
// Performance:
//   - one repository lookup.
func (s *UserService) loadUserByID(ctx context.Context, userRepo repository.UserRepository, userID string) (*model.User, error) {
	user, err := userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}

// resolveOptionalHumanNameUpdate validates a partial human-name update.
//
// Inputs:
//   - current is the existing stored value.
//   - input is the optional patch value.
//   - maxLength bounds the resulting normalized name.
//
// Returns:
//   - the normalized value.
//   - whether the value changed.
//   - a validation error for invalid names.
//
// Edge cases:
//   - nil, blank, and unchanged values are treated as no-ops.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the input length due to normalization.
func resolveOptionalHumanNameUpdate(current string, input *string, maxLength int) (string, bool, error) {
	if input == nil {
		return current, false, nil
	}

	normalized := normalizeHumanName(*input)
	if normalized == "" {
		return current, false, nil
	}
	if !isValidHumanName(normalized, maxLength) {
		return current, false, ErrInvalidProfileName
	}
	if normalized == current {
		return current, false, nil
	}

	return normalized, true, nil
}

// resolveOptionalPhone extracts a normalized phone value from an optional patch field.
//
// Inputs:
//   - input is the optional phone patch.
//
// Returns:
//   - the normalized phone value.
//   - whether a meaningful phone patch was provided.
//
// Edge cases:
//   - nil and blank values are treated as no-ops.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the input length due to normalization.
func resolveOptionalPhone(input *string) (string, bool) {
	if input == nil {
		return "", false
	}

	normalized := normalizePhone(*input)
	if normalized == "" {
		return "", false
	}

	return normalized, true
}

// resolveOptionalHumanName extracts a normalized name from an optional patch field.
//
// Inputs:
//   - input is the optional name patch.
//
// Returns:
//   - the normalized name.
//   - whether a meaningful patch was provided.
//
// Edge cases:
//   - nil and blank values are treated as no-ops.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the input length due to normalization.
func resolveOptionalHumanName(input *string) (string, bool) {
	if input == nil {
		return "", false
	}

	normalized := normalizeHumanName(*input)
	if normalized == "" {
		return "", false
	}

	return normalized, true
}

// resolveOptionalTrimmedText extracts a trimmed non-empty value from an optional
// text patch.
//
// Inputs:
//   - input is the optional text patch.
//
// Returns:
//   - the trimmed text.
//   - whether a meaningful patch was provided.
//
// Edge cases:
//   - nil and blank values are treated as no-ops.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) over the input length due to trimming.
func resolveOptionalTrimmedText(input *string) (string, bool) {
	if input == nil {
		return "", false
	}

	trimmed := strings.TrimSpace(*input)
	if trimmed == "" {
		return "", false
	}

	return trimmed, true
}

// hasMeaningfulProfileAddressPatch detects whether an address patch contains any
// field that would actually change or create an address.
//
// Inputs:
//   - input is the raw profile address patch.
//
// Returns:
//   - true when at least one field contains a meaningful value after normalization.
//
// Edge cases:
//   - fields containing only whitespace are treated as empty.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(k) across the small fixed number of address fields.
func hasMeaningfulProfileAddressPatch(input dto.UpdateProfileAddressInput) bool {
	if _, ok := resolveOptionalHumanName(input.RecipientName); ok {
		return true
	}
	if _, ok := resolveOptionalPhone(input.Phone); ok {
		return true
	}
	if _, ok := resolveOptionalTrimmedText(input.Street); ok {
		return true
	}
	if _, ok := resolveOptionalTrimmedText(input.Ward); ok {
		return true
	}
	if _, ok := resolveOptionalTrimmedText(input.District); ok {
		return true
	}
	if _, ok := resolveOptionalTrimmedText(input.City); ok {
		return true
	}
	return false
}

// mergeProfileAddressInput merges a partial address patch with the current
// default address or a fallback phone number.
//
// Inputs:
//   - current is the current default address, if any.
//   - fallbackPhone is the profile phone used when no address exists yet.
//   - input is the partial profile address patch.
//
// Returns:
//   - the merged address input.
//   - whether the merged result differs meaningfully from the current address.
//
// Edge cases:
//   - when no current address exists, any meaningful patch is treated as a new address.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1) across a fixed number of fields.
func mergeProfileAddressInput(current *model.Address, fallbackPhone string, input dto.UpdateProfileAddressInput) (dto.ProfileAddressInput, bool) {
	merged := dto.ProfileAddressInput{}
	if current != nil {
		merged.RecipientName = current.RecipientName
		merged.Phone = current.Phone
		merged.Street = current.Street
		merged.Ward = current.Ward
		merged.District = current.District
		merged.City = current.City
	} else {
		merged.Phone = normalizePhone(fallbackPhone)
	}

	hasPatch := false
	if recipientName, ok := resolveOptionalHumanName(input.RecipientName); ok {
		merged.RecipientName = recipientName
		hasPatch = true
	}
	if phone, ok := resolveOptionalPhone(input.Phone); ok {
		merged.Phone = phone
		hasPatch = true
	}
	if street, ok := resolveOptionalTrimmedText(input.Street); ok {
		merged.Street = street
		hasPatch = true
	}
	if ward, ok := resolveOptionalTrimmedText(input.Ward); ok {
		merged.Ward = ward
		hasPatch = true
	}
	if district, ok := resolveOptionalTrimmedText(input.District); ok {
		merged.District = district
		hasPatch = true
	}
	if city, ok := resolveOptionalTrimmedText(input.City); ok {
		merged.City = city
		hasPatch = true
	}

	if !hasPatch {
		return merged, false
	}
	if current == nil {
		return merged, true
	}

	changed := merged.RecipientName != current.RecipientName ||
		merged.Phone != current.Phone ||
		merged.Street != current.Street ||
		merged.Ward != current.Ward ||
		merged.District != current.District ||
		merged.City != current.City

	return merged, changed
}

// normalizeProfileAddressInput normalizes a complete profile-address payload
// before validation or persistence.
//
// Inputs:
//   - input is the address payload to normalize.
//
// Returns:
//   - the normalized address payload.
//
// Edge cases:
//   - optional ward fields remain optional after normalization.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(n) across the combined field lengths.
func normalizeProfileAddressInput(input dto.ProfileAddressInput) dto.ProfileAddressInput {
	return dto.ProfileAddressInput{
		RecipientName: normalizeHumanName(input.RecipientName),
		Phone:         normalizePhone(input.Phone),
		Street:        strings.TrimSpace(input.Street),
		Ward:          strings.TrimSpace(input.Ward),
		District:      strings.TrimSpace(input.District),
		City:          strings.TrimSpace(input.City),
	}
}

// isValidProfileAddressInput validates a normalized profile-address payload
// against the current business rules.
//
// Inputs:
//   - input is the normalized address payload.
//
// Returns:
//   - true when the payload satisfies all address requirements.
//
// Edge cases:
//   - ward remains optional while all other major fields are required.
//
// Side effects:
//   - none.
//
// Performance:
//   - O(1) once the input is normalized.
func isValidProfileAddressInput(input dto.ProfileAddressInput) bool {
	if !isValidHumanName(input.RecipientName, 100) {
		return false
	}
	if !isValidVNPhone(input.Phone) {
		return false
	}
	if len(input.Street) < 5 || len(input.Street) > 255 {
		return false
	}
	if len(input.Ward) > 100 {
		return false
	}
	if len(input.District) < 2 || len(input.District) > 100 {
		return false
	}
	if len(input.City) < 2 || len(input.City) > 100 {
		return false
	}

	return true
}
