package engagementservice

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/dto"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/model"
	"github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/user-service/internal/repository"
)

var ErrInvalidNotificationPreferenceTopic = errors.New("invalid notification preference topic")

type NotificationPreferenceService struct {
	repo repository.NotificationPreferenceRepository
}

func NewNotificationPreferenceService(
	repo repository.NotificationPreferenceRepository,
) *NotificationPreferenceService {
	return &NotificationPreferenceService{repo: repo}
}

func (s *NotificationPreferenceService) ListPreferences(
	ctx context.Context,
	userID string,
) ([]*model.NotificationPreference, error) {
	return s.listEffectivePreferences(ctx, strings.TrimSpace(userID))
}

func (s *NotificationPreferenceService) UpdatePreferences(
	ctx context.Context,
	userID string,
	req dto.UpdateNotificationPreferencesRequest,
) ([]*model.NotificationPreference, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, ErrInvalidNotificationPreferenceTopic
	}

	existing, err := s.listEffectivePreferences(ctx, userID)
	if err != nil {
		return nil, err
	}
	byTopic := make(map[string]*model.NotificationPreference, len(existing))
	for _, preference := range existing {
		copyValue := *preference
		byTopic[preference.Topic] = &copyValue
	}

	now := time.Now()
	for _, item := range req.Preferences {
		topic := strings.TrimSpace(item.Topic)
		if !isSupportedNotificationTopic(topic) {
			return nil, ErrInvalidNotificationPreferenceTopic
		}
		byTopic[topic] = &model.NotificationPreference{
			UserID:    userID,
			Topic:     topic,
			Enabled:   item.Enabled,
			UpdatedAt: now,
		}
	}

	preferences := flattenNotificationPreferences(byTopic)
	if err := s.repo.UpsertMany(ctx, userID, preferences); err != nil {
		return nil, err
	}

	return s.listEffectivePreferences(ctx, userID)
}

func (s *NotificationPreferenceService) PreferenceMap(
	ctx context.Context,
	userID string,
) (map[string]bool, error) {
	preferences, err := s.listEffectivePreferences(ctx, strings.TrimSpace(userID))
	if err != nil {
		return nil, err
	}

	preferenceMap := make(map[string]bool, len(preferences))
	for _, preference := range preferences {
		preferenceMap[preference.Topic] = preference.Enabled
	}
	return preferenceMap, nil
}

func (s *NotificationPreferenceService) listEffectivePreferences(
	ctx context.Context,
	userID string,
) ([]*model.NotificationPreference, error) {
	existing, err := s.repo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	byTopic := defaultNotificationPreferences(userID, now)
	for _, preference := range existing {
		if preference == nil || !isSupportedNotificationTopic(preference.Topic) {
			continue
		}
		copyValue := *preference
		byTopic[preference.Topic] = &copyValue
	}

	return flattenNotificationPreferences(byTopic), nil
}

func defaultNotificationPreferences(
	userID string,
	now time.Time,
) map[string]*model.NotificationPreference {
	topics := supportedNotificationTopics()
	preferences := make(map[string]*model.NotificationPreference, len(topics))
	for _, topic := range topics {
		preferences[topic] = &model.NotificationPreference{
			UserID:    userID,
			Topic:     topic,
			Enabled:   true,
			UpdatedAt: now,
		}
	}
	return preferences
}

func supportedNotificationTopics() []string {
	return []string{
		model.NotificationTopicOrderUpdates,
		model.NotificationTopicPaymentUpdates,
		model.NotificationTopicReturnUpdates,
		model.NotificationTopicWishlistBackInStock,
		model.NotificationTopicWishlistPriceDrop,
	}
}

func isSupportedNotificationTopic(topic string) bool {
	for _, supported := range supportedNotificationTopics() {
		if topic == supported {
			return true
		}
	}
	return false
}

func flattenNotificationPreferences(
	byTopic map[string]*model.NotificationPreference,
) []*model.NotificationPreference {
	topics := make([]string, 0, len(byTopic))
	for topic := range byTopic {
		topics = append(topics, topic)
	}
	sort.Strings(topics)

	preferences := make([]*model.NotificationPreference, 0, len(topics))
	for _, topic := range topics {
		preferences = append(preferences, byTopic[topic])
	}
	return preferences
}
