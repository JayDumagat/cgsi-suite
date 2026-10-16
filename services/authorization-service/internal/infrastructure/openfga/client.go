package openfga

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"cgsi-suite/services/authorization-service/internal/domain"
	"cgsi-suite/services/shared/platform/observability"
)

type Client struct {
	baseURL string
	http    *http.Client
}

type tupleKey struct {
	User     string `json:"user"`
	Relation string `json:"relation"`
	Object   string `json:"object"`
}

func toTupleKey(tuple domain.Tuple) tupleKey {
	return tupleKey{User: tuple.User, Relation: tuple.Relation, Object: tuple.Object}
}

func NewClient(baseURL string) *Client {
	return &Client{baseURL: strings.TrimRight(baseURL, "/"), http: &http.Client{Timeout: 5 * time.Second}}
}

func (c *Client) EnsureStore(ctx context.Context, name string) (string, error) {
	var result struct {
		Stores []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"stores"`
	}
	if err := c.request(ctx, http.MethodGet, "/stores?page_size=100", nil, &result); err != nil {
		return "", err
	}
	for _, store := range result.Stores {
		if store.Name == name {
			return store.ID, nil
		}
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := c.request(ctx, http.MethodPost, "/stores", map[string]string{"name": name}, &created); err != nil {
		return "", err
	}
	if created.ID == "" {
		return "", fmt.Errorf("OpenFGA created store without an ID")
	}
	return created.ID, nil
}

func (c *Client) EnsureModel(ctx context.Context, storeID string) (string, error) {
	expected, err := expectedModel()
	if err != nil {
		return "", err
	}
	var result struct {
		Models []struct {
			ID    string `json:"id"`
			Model any    `json:"model"`
		} `json:"authorization_models"`
	}
	path := fmt.Sprintf("/stores/%s/authorization-models?page_size=100", storeID)
	if err := c.request(ctx, http.MethodGet, path, nil, &result); err != nil {
		return "", err
	}
	for _, model := range result.Models {
		if modelsEqual(expected, model.Model) {
			return model.ID, nil
		}
	}
	var created struct {
		ID string `json:"authorization_model_id"`
	}
	path = fmt.Sprintf("/stores/%s/authorization-models", storeID)
	if err := c.request(ctx, http.MethodPost, path, expected, &created); err != nil {
		return "", err
	}
	if created.ID == "" {
		return "", fmt.Errorf("OpenFGA created authorization model without an ID")
	}
	return created.ID, nil
}

func (c *Client) Check(ctx context.Context, storeID, modelID string, tuple domain.Tuple) (bool, error) {
	var result struct {
		Allowed bool `json:"allowed"`
	}
	path := fmt.Sprintf("/stores/%s/check", storeID)
	payload := map[string]any{"tuple_key": toTupleKey(tuple), "authorization_model_id": modelID}
	if err := c.request(ctx, http.MethodPost, path, payload, &result); err != nil {
		return false, err
	}
	return result.Allowed, nil
}

func (c *Client) Write(ctx context.Context, storeID, modelID string, tuple domain.Tuple) error {
	path := fmt.Sprintf("/stores/%s/write", storeID)
	payload := map[string]any{
		"writes":                 map[string]any{"tuple_keys": []tupleKey{toTupleKey(tuple)}, "on_duplicate": "ignore"},
		"authorization_model_id": modelID,
	}
	return c.request(ctx, http.MethodPost, path, payload, nil)
}

func (c *Client) request(ctx context.Context, method, path string, payload, output any) error {
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return err
	}
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	observability.InjectTraceContext(ctx, request)
	response, err := c.http.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(response.Body, 1000))
		return fmt.Errorf("OpenFGA returned %d: %s", response.StatusCode, strings.TrimSpace(string(detail)))
	}
	if output == nil || response.StatusCode == http.StatusNoContent {
		return nil
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(output); err != nil {
		return fmt.Errorf("decode OpenFGA response: %w", err)
	}
	return nil
}
