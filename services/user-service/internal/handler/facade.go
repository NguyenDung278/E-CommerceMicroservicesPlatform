package handler

import (
	"time"

	addresshandler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/handler/address"
	notificationpreferencehandler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/handler/notificationpreference"
	userhandler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/handler/user"
	wishlisthandler "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/handler/wishlist"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

type UserHandler = userhandler.UserHandler
type LoginAttemptProtector = userhandler.LoginAttemptProtector
type AddressHandler = addresshandler.AddressHandler
type WishlistHandler = wishlisthandler.WishlistHandler
type NotificationPreferenceHandler = notificationpreferencehandler.NotificationPreferenceHandler

func NewUserHandler(userService *service.UserService) *UserHandler {
	return userhandler.NewUserHandler(userService)
}

func NewUserHandlerWithLoginProtector(
	userService *service.UserService,
	loginProtector *LoginAttemptProtector,
) *UserHandler {
	return userhandler.NewUserHandlerWithLoginProtector(userService, loginProtector)
}

func NewLoginAttemptProtector(
	maxFailures int,
	lockDuration, stateTTL time.Duration,
) *LoginAttemptProtector {
	return userhandler.NewLoginAttemptProtector(maxFailures, lockDuration, stateTTL)
}

func NewAddressHandler(addressService *service.AddressService) *AddressHandler {
	return addresshandler.NewAddressHandler(addressService)
}

func NewWishlistHandler(wishlistService *service.WishlistService) *WishlistHandler {
	return wishlisthandler.NewWishlistHandler(wishlistService)
}

func NewNotificationPreferenceHandler(
	preferenceService *service.NotificationPreferenceService,
) *NotificationPreferenceHandler {
	return notificationpreferencehandler.NewNotificationPreferenceHandler(preferenceService)
}
