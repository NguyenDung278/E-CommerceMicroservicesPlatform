package handler

import (
	"bytes"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/pkg/response"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/product-service/internal/service"
)

const (
	maxProductImageUploads = 8
	maxProductImageSize    = 10 << 20
)

func (h *ProductHandler) UploadImages(c echo.Context) error {
	form, err := c.MultipartForm()
	if err != nil {
		return response.Error(c, http.StatusBadRequest, "invalid form data", "multipart form data is required")
	}

	files := form.File["images"]
	if len(files) == 0 {
		files = form.File["image"]
	}
	if len(files) == 0 {
		return response.Error(c, http.StatusBadRequest, "validation failed", "at least one image file is required")
	}
	if len(files) > maxProductImageUploads {
		return response.Error(c, http.StatusBadRequest, "validation failed", "too many files in one upload")
	}

	images := make([]service.UploadableImage, 0, len(files))
	for _, fileHeader := range files {
		image, err := toUploadableImage(fileHeader)
		if err != nil {
			return response.Error(c, http.StatusBadRequest, "validation failed", err.Error())
		}
		images = append(images, image)
	}

	urls, err := h.productService.UploadImages(c.Request().Context(), images)
	if err != nil {
		if errors.Is(err, service.ErrImageStorageUnavailable) {
			return response.Error(c, http.StatusServiceUnavailable, "upload failed", "object storage is not configured")
		}
		return response.Error(c, http.StatusInternalServerError, "upload failed", "internal server error")
	}

	return response.Success(c, http.StatusCreated, "images uploaded", dto.UploadProductImagesResponse{URLs: urls})
}

func toUploadableImage(fileHeader *multipart.FileHeader) (service.UploadableImage, error) {
	if fileHeader.Size > maxProductImageSize {
		return service.UploadableImage{}, errors.New("image size exceeds 10MB limit")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return service.UploadableImage{}, errors.New("failed to open uploaded file")
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, maxProductImageSize+1))
	if err != nil {
		return service.UploadableImage{}, errors.New("failed to read uploaded file")
	}
	if int64(len(data)) > maxProductImageSize {
		return service.UploadableImage{}, errors.New("image size exceeds 10MB limit")
	}

	contentType := strings.TrimSpace(fileHeader.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = http.DetectContentType(data)
	}
	if !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		return service.UploadableImage{}, errors.New("only image files are supported")
	}

	return service.UploadableImage{
		FileName:    fileHeader.Filename,
		ContentType: contentType,
		Size:        int64(len(data)),
		Reader:      bytes.NewReader(data),
	}, nil
}
