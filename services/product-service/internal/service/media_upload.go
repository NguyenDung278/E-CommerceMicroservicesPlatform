package service

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

type MediaStore interface {
	EnsureBucket(ctx context.Context) error
	Upload(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) (string, error)
}

type UploadableImage struct {
	FileName    string
	ContentType string
	Size        int64
	Reader      io.Reader
}

func (s *ProductService) EnsureMediaStore(ctx context.Context) error {
	if s.mediaStore == nil {
		return ErrImageStorageUnavailable
	}

	return s.mediaStore.EnsureBucket(ctx)
}

func (s *ProductService) UploadImages(ctx context.Context, images []UploadableImage) ([]string, error) {
	if s.mediaStore == nil {
		return nil, ErrImageStorageUnavailable
	}
	if len(images) == 0 {
		return []string{}, nil
	}
	if err := s.mediaStore.EnsureBucket(ctx); err != nil {
		return nil, err
	}

	urls := make([]string, 0, len(images))
	for _, image := range images {
		objectKey := buildProductImageObjectKey(image.FileName)
		imageURL, err := s.mediaStore.Upload(ctx, objectKey, image.Reader, image.Size, image.ContentType)
		if err != nil {
			return nil, err
		}
		urls = append(urls, imageURL)
	}

	return urls, nil
}

func buildProductImageObjectKey(fileName string) string {
	ext := strings.ToLower(filepath.Ext(strings.TrimSpace(fileName)))
	if ext == "" {
		ext = ".bin"
	}

	now := time.Now().UTC()
	return fmt.Sprintf(
		"products/%04d/%02d/%s%s",
		now.Year(),
		now.Month(),
		uuid.New().String(),
		ext,
	)
}
