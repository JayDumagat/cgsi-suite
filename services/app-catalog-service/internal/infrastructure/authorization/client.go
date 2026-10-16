package authorization

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"cgsi-suite/services/shared/platform/observability"
)

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func NewClient(baseURL, token string) *Client {
	return &Client{baseURL: baseURL, token: token, http: &http.Client{Timeout: 5 * time.Second}}
}

func (c *Client) CanAccess(ctx context.Context, objectID, object string) (bool, error) {
	requestBody, err := json.Marshal(map[string]string{
		"user": "user:" + objectID, "relation": "can_access", "object": object,
	})
	if err != nil {
		return false, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/check", bytes.NewReader(requestBody))
	if err != nil {
		return false, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-CGSI-Service-Token", c.token)
	observability.InjectTraceContext(ctx, request)
	response, err := c.http.Do(request)
	if err != nil {
		return false, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return false, fmt.Errorf("authorization service returned %d", response.StatusCode)
	}
	var result struct {
		Allowed *bool `json:"allowed"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 16<<10)).Decode(&result); err != nil {
		return false, fmt.Errorf("decode authorization response: %w", err)
	}
	if result.Allowed == nil {
		return false, fmt.Errorf("authorization service returned an invalid check result")
	}
	return *result.Allowed, nil
}
