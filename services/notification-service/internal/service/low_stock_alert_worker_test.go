package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"

	notificationclient "github.com/NguyenDung278/E-CommerceMicroservicesPlatform/services/notification-service/internal/client"
)

type fakeLowStockSource struct {
	entries []notificationclient.LowStockEntry
	err     error
	calls   int
}

func (s *fakeLowStockSource) ListLowStock(
	_ context.Context,
	_ int,
	_ int,
) ([]notificationclient.LowStockEntry, error) {
	s.calls++
	if s.err != nil {
		return nil, s.err
	}
	return s.entries, nil
}

type fakeLowStockDeduper struct {
	claimed  map[string]bool
	err      error
	released []string
}

func (d *fakeLowStockDeduper) Claim(
	_ context.Context,
	entry notificationclient.LowStockEntry,
) (bool, error) {
	if d.err != nil {
		return false, d.err
	}
	if d.claimed == nil {
		return true, nil
	}
	value, ok := d.claimed[entry.ProductID+"|"+entry.SKU]
	if !ok {
		return true, nil
	}
	return value, nil
}

func (d *fakeLowStockDeduper) Release(
	_ context.Context,
	entry notificationclient.LowStockEntry,
) error {
	d.released = append(d.released, entry.ProductID+"|"+entry.SKU)
	return nil
}

func newTestLowStockWorker(
	sender *fakeEmailSender,
	source lowStockSource,
	deduper LowStockAlertDeduper,
	recipients []string,
) *LowStockAlertWorker {
	return NewLowStockAlertWorker(
		zap.NewNop(),
		sender,
		source,
		deduper,
		recipients,
		time.Minute,
		5,
		50,
	)
}

func TestLowStockAlertWorkerSendsSingleDigestForClaimedEntries(t *testing.T) {
	sender := &fakeEmailSender{}
	worker := newTestLowStockWorker(
		sender,
		&fakeLowStockSource{
			entries: []notificationclient.LowStockEntry{
				{ProductID: "product-1", ProductName: "Archive Coat", Stock: 3, Threshold: 5},
				{
					ProductID:    "product-2",
					ProductName:  "Field Trousers",
					SKU:          "FT-M",
					VariantLabel: "M",
					Stock:        0,
					Threshold:    5,
				},
			},
		},
		&fakeLowStockDeduper{},
		[]string{"ops@example.com"},
	)

	worker.runCycle(context.Background())

	if len(sender.messages) != 1 {
		t.Fatalf("expected exactly one digest email, got %d", len(sender.messages))
	}

	body := sender.messages[0].Body
	if !strings.Contains(body, "Archive Coat") || !strings.Contains(body, "Field Trousers - M") {
		t.Fatalf("expected digest to list both entries, got:\n%s", body)
	}
	// Hết hàng và sắp hết phải nằm ở hai mục khác nhau để người đọc biết cái nào
	// cần xử lý trước.
	if !strings.Contains(body, "DA HET HANG") || !strings.Contains(body, "SAP HET HANG") {
		t.Fatalf("expected digest to separate out-of-stock from running-low, got:\n%s", body)
	}
}

func TestLowStockAlertWorkerSkipsEntriesAlreadyClaimed(t *testing.T) {
	sender := &fakeEmailSender{}
	worker := newTestLowStockWorker(
		sender,
		&fakeLowStockSource{
			entries: []notificationclient.LowStockEntry{
				{ProductID: "product-1", ProductName: "Archive Coat", Stock: 3},
				{ProductID: "product-2", ProductName: "Field Trousers", Stock: 2},
			},
		},
		&fakeLowStockDeduper{
			claimed: map[string]bool{
				"product-1|": false,
				"product-2|": true,
			},
		},
		[]string{"ops@example.com"},
	)

	worker.runCycle(context.Background())

	if len(sender.messages) != 1 {
		t.Fatalf("expected one digest email, got %d", len(sender.messages))
	}
	if strings.Contains(sender.messages[0].Body, "Archive Coat") {
		t.Fatal("expected already-claimed entry to be excluded from the digest")
	}
}

func TestLowStockAlertWorkerSendsNothingWhenEverythingClaimed(t *testing.T) {
	sender := &fakeEmailSender{}
	worker := newTestLowStockWorker(
		sender,
		&fakeLowStockSource{
			entries: []notificationclient.LowStockEntry{
				{ProductID: "product-1", ProductName: "Archive Coat", Stock: 3},
			},
		},
		&fakeLowStockDeduper{claimed: map[string]bool{"product-1|": false}},
		[]string{"ops@example.com"},
	)

	worker.runCycle(context.Background())

	if len(sender.messages) != 0 {
		t.Fatalf("expected no email when every entry was already alerted, got %d", len(sender.messages))
	}
}

// Gửi hỏng mà vẫn giữ claim thì cảnh báo im lặng suốt TTL — chu kỳ sau phải báo
// lại được.
func TestLowStockAlertWorkerReleasesClaimsWhenSendFails(t *testing.T) {
	sender := &fakeEmailSender{err: errors.New("smtp down")}
	deduper := &fakeLowStockDeduper{}
	worker := newTestLowStockWorker(
		sender,
		&fakeLowStockSource{
			entries: []notificationclient.LowStockEntry{
				{ProductID: "product-1", ProductName: "Archive Coat", Stock: 3},
				{ProductID: "product-2", ProductName: "Field Trousers", SKU: "FT-M", Stock: 1},
			},
		},
		deduper,
		[]string{"ops@example.com"},
	)

	worker.runCycle(context.Background())

	if len(deduper.released) != 2 {
		t.Fatalf("expected both claims to be released after a failed send, got %v", deduper.released)
	}
}

func TestLowStockAlertWorkerSkipsCycleOnSourceError(t *testing.T) {
	sender := &fakeEmailSender{}
	worker := newTestLowStockWorker(
		sender,
		&fakeLowStockSource{err: errors.New("product-service unavailable")},
		&fakeLowStockDeduper{},
		[]string{"ops@example.com"},
	)

	worker.runCycle(context.Background())

	if len(sender.messages) != 0 {
		t.Fatalf("expected no email when the source fails, got %d", len(sender.messages))
	}
}

// Recipients rỗng phải làm worker dừng hẳn thay vì quét rồi vứt kết quả đi.
func TestLowStockAlertWorkerDoesNotPollWithoutRecipients(t *testing.T) {
	sender := &fakeEmailSender{}
	source := &fakeLowStockSource{
		entries: []notificationclient.LowStockEntry{
			{ProductID: "product-1", ProductName: "Archive Coat", Stock: 3},
		},
	}
	worker := newTestLowStockWorker(sender, source, &fakeLowStockDeduper{}, nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	worker.Start(ctx)

	if source.calls != 0 {
		t.Fatalf("expected worker to skip polling entirely, got %d calls", source.calls)
	}
	if len(sender.messages) != 0 {
		t.Fatalf("expected no email without recipients, got %d", len(sender.messages))
	}
}

func TestNormalizeRecipientsDropsInvalidAndDuplicateAddresses(t *testing.T) {
	got := normalizeRecipients([]string{
		" ops@example.com ",
		"",
		"not-an-email",
		"ops@example.com",
		"warehouse@example.com",
	})

	want := []string{"ops@example.com", "warehouse@example.com"}
	if len(got) != len(want) {
		t.Fatalf("expected %v, got %v", want, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("expected %v, got %v", want, got)
		}
	}
}
