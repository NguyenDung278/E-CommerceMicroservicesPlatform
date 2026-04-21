package model

import (
	addressmodel "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model/addressmodel"
	authmodel "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model/authmodel"
	notificationmodel "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model/notificationmodel"
	usermodel "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model/usermodel"
	wishlistmodel "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model/wishlistmodel"
)

type Address = addressmodel.Address

type EmailSignupChallenge = authmodel.EmailSignupChallenge
type EmailVerificationChallenge = authmodel.EmailVerificationChallenge
type PhoneSignupChallenge = authmodel.PhoneSignupChallenge
type PhoneVerificationChallenge = authmodel.PhoneVerificationChallenge

const (
	EmailVerificationPurposeSignUp = authmodel.EmailVerificationPurposeSignUp

	EmailVerificationStatusPending  = authmodel.EmailVerificationStatusPending
	EmailVerificationStatusVerified = authmodel.EmailVerificationStatusVerified
	EmailVerificationStatusLocked   = authmodel.EmailVerificationStatusLocked
	EmailVerificationStatusConsumed = authmodel.EmailVerificationStatusConsumed
	EmailVerificationStatusExpired  = authmodel.EmailVerificationStatusExpired

	PhoneVerificationPurposeProfileUpdate = authmodel.PhoneVerificationPurposeProfileUpdate

	PhoneVerificationStatusPending  = authmodel.PhoneVerificationStatusPending
	PhoneVerificationStatusVerified = authmodel.PhoneVerificationStatusVerified
	PhoneVerificationStatusLocked   = authmodel.PhoneVerificationStatusLocked
	PhoneVerificationStatusConsumed = authmodel.PhoneVerificationStatusConsumed
	PhoneVerificationStatusExpired  = authmodel.PhoneVerificationStatusExpired
)

type NotificationPreference = notificationmodel.NotificationPreference

const (
	NotificationTopicOrderUpdates        = notificationmodel.NotificationTopicOrderUpdates
	NotificationTopicPaymentUpdates      = notificationmodel.NotificationTopicPaymentUpdates
	NotificationTopicReturnUpdates       = notificationmodel.NotificationTopicReturnUpdates
	NotificationTopicWishlistBackInStock = notificationmodel.NotificationTopicWishlistBackInStock
	NotificationTopicWishlistPriceDrop   = notificationmodel.NotificationTopicWishlistPriceDrop
)

type OAuthAccount = usermodel.OAuthAccount
type User = usermodel.User
type UserAvatar = usermodel.UserAvatar

type WishlistItem = wishlistmodel.WishlistItem
type WishlistAlert = wishlistmodel.WishlistAlert
type WishlistAlertDelivery = wishlistmodel.WishlistAlertDelivery

const (
	WishlistAlertKindBackInStock = wishlistmodel.WishlistAlertKindBackInStock
	WishlistAlertKindPriceDrop   = wishlistmodel.WishlistAlertKindPriceDrop
)
