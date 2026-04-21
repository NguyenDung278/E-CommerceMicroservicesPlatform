package userhandler

import (
	"bytes"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/validation"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/service"
)

func (h *UserHandler) GetProfile(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	user, err := h.userService.GetProfile(c.Request().Context(), claims.UserID)
	if err != nil {
		if errors.Is(err, service.ErrUserNotFound) {
			return response.Error(c, http.StatusNotFound, "not found", "user not found")
		}
		return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
	}

	return response.Success(c, http.StatusOK, "profile retrieved", user)
}

func (h *UserHandler) UpdateProfile(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	var req dto.UpdateProfileRequest
	if err := c.Bind(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid request body", err.Error())
	}
	if err := c.Validate(&req); err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", validation.Message(err))
	}

	user, err := h.userService.UpdateProfile(c.Request().Context(), claims.UserID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserNotFound):
			return response.Error(c, http.StatusNotFound, "not found", "user not found")
		case errors.Is(err, service.ErrInvalidPhoneNumber):
			return response.Error(c, http.StatusBadRequest, "validation failed", "invalid phone number")
		case errors.Is(err, service.ErrInvalidProfileName):
			return response.Error(c, http.StatusBadRequest, "validation failed", "invalid first name or last name")
		case errors.Is(err, service.ErrInvalidProfileAddress):
			return response.Error(c, http.StatusBadRequest, "validation failed", "invalid default address")
		case errors.Is(err, service.ErrPhoneAlreadyExists):
			return response.Error(c, http.StatusConflict, "profile update failed", "phone already exists")
		case errors.Is(err, service.ErrPhoneVerificationRequired):
			return response.Error(c, http.StatusBadRequest, "profile update failed", "phone verification required")
		case errors.Is(err, service.ErrPhoneVerificationNotFound),
			errors.Is(err, service.ErrPhoneVerificationAlreadyUsed):
			return response.Error(c, http.StatusBadRequest, "profile update failed", "phone verification is invalid or already used")
		default:
			return response.Error(c, http.StatusInternalServerError, "error", "internal server error")
		}
	}

	return response.Success(c, http.StatusOK, "profile updated", user)
}

func (h *UserHandler) UploadAvatar(c echo.Context) error {
	claims, err := requireUserClaims(c)
	if err != nil {
		return err
	}

	fileHeader, err := c.FormFile("avatar")
	if err != nil {
		fileHeader, err = c.FormFile("image")
	}
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", "avatar image file is required")
	}

	input, err := toUploadAvatarInput(fileHeader)
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "validation failed", err.Error())
	}

	result, err := h.userService.UploadAvatar(c.Request().Context(), claims.UserID, input)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUserNotFound):
			return response.Error(c, http.StatusNotFound, "not found", "user not found")
		case errors.Is(err, service.ErrInvalidAvatarFile):
			return response.Error(c, http.StatusBadRequest, "validation failed", "only image files are supported")
		case errors.Is(err, service.ErrAvatarTooLarge):
			return response.Error(c, http.StatusBadRequest, "validation failed", "avatar image size exceeds 5MB limit")
		default:
			return response.Error(c, http.StatusInternalServerError, "avatar upload failed", "internal server error")
		}
	}

	return response.Success(c, http.StatusCreated, "avatar uploaded", result)
}

func toUploadAvatarInput(fileHeader *multipart.FileHeader) (dto.UploadAvatarInput, error) {
	if fileHeader == nil {
		return dto.UploadAvatarInput{}, errors.New("avatar image file is required")
	}
	if fileHeader.Size > maxAvatarUploadSize {
		return dto.UploadAvatarInput{}, errors.New("avatar image size exceeds 5MB limit")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return dto.UploadAvatarInput{}, errors.New("failed to open uploaded avatar")
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxAvatarUploadSize+1))
	if err != nil {
		return dto.UploadAvatarInput{}, errors.New("failed to read uploaded avatar")
	}
	if len(data) == 0 {
		return dto.UploadAvatarInput{}, errors.New("avatar image file is required")
	}
	if len(data) > maxAvatarUploadSize {
		return dto.UploadAvatarInput{}, errors.New("avatar image size exceeds 5MB limit")
	}

	contentType := strings.TrimSpace(fileHeader.Header.Get("Content-Type"))
	if contentType == "" || contentType == "application/octet-stream" {
		contentType = http.DetectContentType(data)
	}
	if !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		return dto.UploadAvatarInput{}, errors.New("only image files are supported")
	}

	return dto.UploadAvatarInput{
		FileName:    strings.TrimSpace(fileHeader.Filename),
		ContentType: contentType,
		Data:        bytes.Clone(data),
	}, nil
}
