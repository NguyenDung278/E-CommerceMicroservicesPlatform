package validation

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
)

// CustomValidator adapts go-playground/validator to Echo's validator interface.
//
// WHY THIS EXISTS:
// Echo expects a type with Validate(i interface{}) error.
// go-playground/validator gives us declarative validation via struct tags like:
//
//	validate:"required,email"
//
// By bridging them here, every HTTP service can reuse the same validation rules.
type CustomValidator struct {
	validator *validator.Validate
}

// New creates a shared validator instance for Echo services.
func New() *CustomValidator {
	v := validator.New()

	// Prefer JSON field names in validation errors so clients see familiar keys.
	v.RegisterTagNameFunc(func(field reflect.StructField) string {
		name := strings.Split(field.Tag.Get("json"), ",")[0]
		if name == "" || name == "-" {
			return field.Name
		}
		return name
	})

	return &CustomValidator{validator: v}
}

// Validate implements echo.Validator.
func (cv *CustomValidator) Validate(i interface{}) error {
	if err := cv.validator.Struct(i); err != nil {
		if validationErrors, ok := err.(validator.ValidationErrors); ok {
			return echo.NewHTTPError(400, formatValidationErrors(validationErrors))
		}
		return err
	}

	return nil
}

// Message extracts a client-friendly validation message.
func Message(err error) string {
	if httpErr, ok := err.(*echo.HTTPError); ok {
		if message, ok := httpErr.Message.(string); ok {
			return message
		}
	}

	return err.Error()
}

func formatValidationErrors(errs validator.ValidationErrors) string {
	messages := make([]string, 0, len(errs))

	for _, fieldErr := range errs {
		fieldName := fieldErr.Field()
		if fieldName == "" {
			fieldName = strings.ToLower(fieldErr.StructField())
		}

		switch fieldErr.Tag() {
		case "required":
			messages = append(messages, fmt.Sprintf("%s is required", fieldName))
		case "email":
			messages = append(messages, fmt.Sprintf("%s must be a valid email", fieldName))
		case "min":
			messages = append(messages, fmt.Sprintf("%s must have at least %s characters/items", fieldName, fieldErr.Param()))
		case "max":
			messages = append(messages, fmt.Sprintf("%s must have at most %s characters/items", fieldName, fieldErr.Param()))
		case "gt":
			messages = append(messages, fmt.Sprintf("%s must be greater than %s", fieldName, fieldErr.Param()))
		case "gte":
			messages = append(messages, fmt.Sprintf("%s must be greater than or equal to %s", fieldName, fieldErr.Param()))
		case "lt":
			messages = append(messages, fmt.Sprintf("%s must be less than %s", fieldName, fieldErr.Param()))
		case "lte":
			messages = append(messages, fmt.Sprintf("%s must be less than or equal to %s", fieldName, fieldErr.Param()))
		default:
			messages = append(messages, fmt.Sprintf("%s failed validation rule %s", fieldName, fieldErr.Tag()))
		}
	}

	return strings.Join(messages, ", ")
}
