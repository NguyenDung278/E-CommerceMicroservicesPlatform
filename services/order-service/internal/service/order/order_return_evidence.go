package service

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/order-service/internal/model"
)

func (s *OrderService) UploadReturnEvidence(
	ctx context.Context,
	returnID, actorID, actorRole string,
	uploads []model.ReturnEvidenceUpload,
) (*model.ReturnRequest, error) {
	if len(uploads) == 0 {
		return nil, ErrReturnEvidenceRequired
	}
	if s.returnMediaStore == nil {
		return nil, ErrReturnEvidenceStorageUnavailable
	}

	returnRequest, err := s.loadReturnByID(ctx, returnID)
	if err != nil {
		return nil, err
	}
	if !isOperatorRole(actorRole) && returnRequest.UserID != actorID {
		return nil, ErrReturnNotFound
	}
	if isClosedReturnForEvidence(returnRequest.Status) {
		return nil, ErrReturnEvidenceClosed
	}
	if err := s.returnMediaStore.EnsureBucket(ctx); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	evidence := make([]model.ReturnEvidence, 0, len(uploads))
	for _, upload := range uploads {
		objectKey := buildReturnEvidenceObjectKey(returnRequest.ID, upload.FileName)
		url, err := s.returnMediaStore.Upload(ctx, objectKey, upload.Reader, upload.Size, upload.ContentType)
		if err != nil {
			return nil, fmt.Errorf("failed to upload return evidence: %w", err)
		}

		evidence = append(evidence, model.ReturnEvidence{
			ID:             uuid.NewString(),
			ReturnID:       returnRequest.ID,
			FileName:       strings.TrimSpace(upload.FileName),
			ContentType:    strings.TrimSpace(upload.ContentType),
			SizeBytes:      upload.Size,
			URL:            url,
			UploadedBy:     actorID,
			UploadedByRole: actorRole,
			CreatedAt:      now,
			StorageKey:     objectKey,
		})
	}

	message := fmt.Sprintf("uploaded %d return evidence file(s)", len(evidence))
	if err := s.repo.AddReturnEvidence(ctx, returnRequest.ID, returnRequest.Status, evidence, actorID, actorRole, message); err != nil {
		return nil, err
	}

	return s.repo.GetReturnByID(ctx, returnRequest.ID)
}

func buildReturnEvidenceObjectKey(returnID, fileName string) string {
	ext := strings.ToLower(filepath.Ext(strings.TrimSpace(fileName)))
	if ext == "" {
		ext = ".bin"
	}

	now := time.Now().UTC()
	return fmt.Sprintf(
		"returns/%04d/%02d/%s/%s%s",
		now.Year(),
		now.Month(),
		returnID,
		uuid.NewString(),
		ext,
	)
}

func isClosedReturnForEvidence(status model.ReturnStatus) bool {
	return status == model.ReturnStatusRejected ||
		status == model.ReturnStatusCancelled ||
		status == model.ReturnStatusRefunded
}
