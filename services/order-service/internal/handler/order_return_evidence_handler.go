package handler

import (
	"bytes"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/middleware"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

const (
	maxReturnEvidenceUploads = 6
	maxReturnEvidenceSize    = 8 << 20
)

func (h *OrderHandler) UploadReturnEvidence(c echo.Context) error {
	claims := middleware.GetUserClaims(c)
	form, err := c.MultipartForm()
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid form data", "multipart form data is required")
	}

	files := form.File["evidence"]
	if len(files) == 0 {
		files = form.File["files"]
	}
	if len(files) == 0 {
		return response.Error(c, http.StatusBadRequest, "validation failed", "at least one evidence file is required")
	}
	if len(files) > maxReturnEvidenceUploads {
		return response.Error(c, http.StatusBadRequest, "validation failed", "too many evidence files in one upload")
	}

	uploads := make([]model.ReturnEvidenceUpload, 0, len(files))
	for _, fileHeader := range files {
		upload, err := toUploadableReturnEvidence(fileHeader)
		if err != nil {
			return response.Error(c, http.StatusBadRequest, "validation failed", err.Error())
		}
		uploads = append(uploads, upload)
	}

	returnRequest, err := h.orderService.UploadReturnEvidence(
		c.Request().Context(),
		c.Param("id"),
		claims.UserID,
		claims.Role,
		uploads,
	)
	if err != nil {
		return writeReturnError(c, err, "failed to upload return evidence")
	}

	return response.Success(c, http.StatusCreated, "return evidence uploaded", returnRequest)
}

func toUploadableReturnEvidence(fileHeader *multipart.FileHeader) (model.ReturnEvidenceUpload, error) {
	if fileHeader.Size > maxReturnEvidenceSize {
		return model.ReturnEvidenceUpload{}, errors.New("evidence file size exceeds 8MB limit")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return model.ReturnEvidenceUpload{}, errors.New("failed to open uploaded evidence file")
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxReturnEvidenceSize+1))
	if err != nil {
		return model.ReturnEvidenceUpload{}, errors.New("failed to read uploaded evidence file")
	}
	if int64(len(data)) > maxReturnEvidenceSize {
		return model.ReturnEvidenceUpload{}, errors.New("evidence file size exceeds 8MB limit")
	}

	contentType := strings.TrimSpace(fileHeader.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = http.DetectContentType(data)
	}
	if !isAllowedReturnEvidenceContentType(contentType) {
		return model.ReturnEvidenceUpload{}, errors.New("only JPG, PNG, or WEBP image files are supported")
	}

	return model.ReturnEvidenceUpload{
		FileName:    fileHeader.Filename,
		ContentType: contentType,
		Size:        int64(len(data)),
		Reader:      bytes.NewReader(data),
	}, nil
}

func isAllowedReturnEvidenceContentType(contentType string) bool {
	switch strings.ToLower(strings.TrimSpace(contentType)) {
	case "image/jpeg", "image/jpg", "image/png", "image/webp":
		return true
	default:
		return false
	}
}
