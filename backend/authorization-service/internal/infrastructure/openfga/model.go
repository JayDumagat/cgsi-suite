package openfga

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
)

//go:embed model.json
var modelDefinition []byte

func expectedModel() (any, error) {
	var model any
	if err := json.Unmarshal(modelDefinition, &model); err != nil {
		return nil, fmt.Errorf("decode embedded OpenFGA model: %w", err)
	}
	return model, nil
}

func modelsEqual(left, right any) bool {
	return bytes.Equal(canonicalModel(left), canonicalModel(right))
}

func canonicalModel(value any) []byte {
	model, ok := value.(map[string]any)
	if !ok {
		return nil
	}
	filtered := make(map[string]any)
	for _, key := range []string{"schema_version", "type_definitions", "conditions"} {
		if item, exists := model[key]; exists {
			filtered[key] = stripEmptyConditions(item)
		}
	}
	encoded, _ := json.Marshal(filtered)
	return encoded
}

func stripEmptyConditions(value any) any {
	switch item := value.(type) {
	case []any:
		result := make([]any, len(item))
		for index, child := range item {
			result[index] = stripEmptyConditions(child)
		}
		return result
	case map[string]any:
		result := make(map[string]any, len(item))
		for key, child := range item {
			if key == "conditions" {
				if conditions, ok := child.(map[string]any); ok && len(conditions) == 0 {
					continue
				}
			}
			result[key] = stripEmptyConditions(child)
		}
		return result
	default:
		return value
	}
}
