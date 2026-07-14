// Phan loai loi delivery: permanent (reject xuong DLQ ngay) va transient
// (duoc phep retry theo retry queue). HandleMessage dua vao phan loai nay.

package handler

import "errors"

type deliveryError struct {
	err       error
	permanent bool
}

func (e *deliveryError) Error() string {
	return e.err.Error()
}

func (e *deliveryError) Unwrap() error {
	return e.err
}

func newPermanentDeliveryError(err error) error {
	if err == nil {
		return nil
	}
	return &deliveryError{err: err, permanent: true}
}

func newTransientDeliveryError(err error) error {
	if err == nil {
		return nil
	}
	return &deliveryError{err: err}
}

func isPermanentDeliveryError(err error) bool {
	var deliveryErr *deliveryError
	return errors.As(err, &deliveryErr) && deliveryErr.permanent
}
