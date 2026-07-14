// Parser cho từng ô Excel và helper thao tác dòng; lỗi được dồn vào
// ValidationErrors thay vì fail sớm để báo đủ mọi dòng hỏng một lượt.

package importer

import (
	"encoding/json"
	"math"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

func parseJSONCell(sheet string, row int, column, value string, validation *ValidationErrors) (json.RawMessage, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		validation.Add("%s row %d: %s is required", sheet, row, column)
		return nil, false
	}

	var parsed any
	if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil {
		validation.Add("%s row %d: %s contains invalid JSON: %v", sheet, row, column, err)
		return nil, false
	}

	return json.RawMessage(trimmed), true
}

func parseTimestampCell(sheet string, row int, column, value string, validation *ValidationErrors) (time.Time, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		validation.Add("%s row %d: %s is required", sheet, row, column)
		return time.Time{}, false
	}

	parsed, err := time.ParseInLocation("2006-01-02 15:04:05", trimmed, time.Local)
	if err != nil {
		validation.Add("%s row %d: %s must use YYYY-MM-DD HH:MM:SS", sheet, row, column)
		return time.Time{}, false
	}

	return parsed, true
}

func parseFloatCell(sheet string, row int, column, value string, validation *ValidationErrors) (float64, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		validation.Add("%s row %d: %s is required", sheet, row, column)
		return 0, false
	}

	parsed, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		validation.Add("%s row %d: %s must be numeric", sheet, row, column)
		return 0, false
	}
	if math.IsNaN(parsed) || math.IsInf(parsed, 0) {
		validation.Add("%s row %d: %s must be a finite number", sheet, row, column)
		return 0, false
	}

	return parsed, true
}

func parseIntCell(sheet string, row int, column, value string, validation *ValidationErrors) (int, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		validation.Add("%s row %d: %s is required", sheet, row, column)
		return 0, false
	}

	parsed, err := strconv.Atoi(trimmed)
	if err != nil {
		validation.Add("%s row %d: %s must be an integer", sheet, row, column)
		return 0, false
	}

	return parsed, true
}

func parseBoolCell(sheet string, row int, column, value string, validation *ValidationErrors) (bool, bool) {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	if trimmed == "" {
		return true, true
	}

	switch trimmed {
	case "true", "1", "yes":
		return true, true
	case "false", "0", "no":
		return false, true
	default:
		validation.Add("%s row %d: %s must be true or false", sheet, row, column)
		return false, false
	}
}

func normalizeOptionalID(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	if _, err := uuid.Parse(trimmed); err != nil {
		return trimmed
	}
	return trimmed
}

func padRow(row []string, width int) []string {
	if len(row) >= width {
		return row[:width]
	}

	padded := make([]string, width)
	copy(padded, row)
	return padded
}

func isBlankRow(row []string) bool {
	return slices.IndexFunc(row, func(value string) bool {
		return strings.TrimSpace(value) != ""
	}) == -1
}

func firstOrEmpty(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

func nullableText(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}
