package model

import ordermodel "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model/order"

type OrderStatus = ordermodel.OrderStatus

const (
	OrderStatusPending   = ordermodel.OrderStatusPending
	OrderStatusPaid      = ordermodel.OrderStatusPaid
	OrderStatusShipped   = ordermodel.OrderStatusShipped
	OrderStatusDelivered = ordermodel.OrderStatusDelivered
	OrderStatusCancelled = ordermodel.OrderStatusCancelled
	OrderStatusRefunded  = ordermodel.OrderStatusRefunded
)

type Order = ordermodel.Order
type OrderPreview = ordermodel.OrderPreview
type ShippingAddress = ordermodel.ShippingAddress
type ShippingMethod = ordermodel.ShippingMethod

const (
	ShippingMethodStandard = ordermodel.ShippingMethodStandard
	ShippingMethodExpress  = ordermodel.ShippingMethodExpress
	ShippingMethodPickup   = ordermodel.ShippingMethodPickup
)

type ShippingOption = ordermodel.ShippingOption
type OrderItem = ordermodel.OrderItem
type SalesTopProduct = ordermodel.SalesTopProduct
type ProductPopularity = ordermodel.ProductPopularity
type SalesStatusBreakdown = ordermodel.SalesStatusBreakdown
type AdminReport = ordermodel.AdminReport
type CouponDiscountType = ordermodel.CouponDiscountType

const (
	CouponDiscountTypeFixed      = ordermodel.CouponDiscountTypeFixed
	CouponDiscountTypePercentage = ordermodel.CouponDiscountTypePercentage
)

type Coupon = ordermodel.Coupon
type CouponWalletItem = ordermodel.CouponWalletItem
type ShipmentTracking = ordermodel.ShipmentTracking
type OrderEvent = ordermodel.OrderEvent
type OrderFilters = ordermodel.OrderFilters
type AuditEntry = ordermodel.AuditEntry
type OutboxMessage = ordermodel.OutboxMessage
type InboxMessage = ordermodel.InboxMessage
type InboxTransitionResult = ordermodel.InboxTransitionResult
type OrderIdempotencyRecord = ordermodel.OrderIdempotencyRecord
type PaymentSummary = ordermodel.PaymentSummary
type UserOrderSummary = ordermodel.UserOrderSummary
type ReturnStatus = ordermodel.ReturnStatus

const (
	ReturnStatusRequested     = ordermodel.ReturnStatusRequested
	ReturnStatusApproved      = ordermodel.ReturnStatusApproved
	ReturnStatusRejected      = ordermodel.ReturnStatusRejected
	ReturnStatusReceived      = ordermodel.ReturnStatusReceived
	ReturnStatusRefundPending = ordermodel.ReturnStatusRefundPending
	ReturnStatusRefunded      = ordermodel.ReturnStatusRefunded
	ReturnStatusCancelled     = ordermodel.ReturnStatusCancelled
)

type ReturnRequest = ordermodel.ReturnRequest
type ReturnItem = ordermodel.ReturnItem
type ReturnEvent = ordermodel.ReturnEvent
type ReturnEvidence = ordermodel.ReturnEvidence
type ReturnEvidenceUpload = ordermodel.ReturnEvidenceUpload
type ReturnFilters = ordermodel.ReturnFilters
type ReturnQueueFailure = ordermodel.ReturnQueueFailure
type ReturnQueueHealth = ordermodel.ReturnQueueHealth

const DefaultReturnWindowDays = ordermodel.DefaultReturnWindowDays

type ReturnEligibilitySnapshot = ordermodel.ReturnEligibilitySnapshot
type ReturnEligibilityItem = ordermodel.ReturnEligibilityItem
