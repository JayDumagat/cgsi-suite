package identity

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"cgsi-suite/services/app-catalog-service/internal/application"
	"cgsi-suite/services/app-catalog-service/internal/domain"
	"cgsi-suite/services/shared/platform/observability"
)

type Client struct {
	baseURL string
	http    *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{baseURL: baseURL, http: &http.Client{Timeout: 5 * time.Second}}
}

func (c *Client) SessionUser(ctx context.Context, cookie string) (application.AuthenticatedPrincipal, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/auth/session", nil)
	if err != nil {
		return application.AuthenticatedPrincipal{}, err
	}
	if cookie != "" {
		request.Header.Set("Cookie", cookie)
	}
	observability.InjectTraceContext(ctx, request)
	response, err := c.http.Do(request)
	if err != nil {
		return application.AuthenticatedPrincipal{}, err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized {
		return application.AuthenticatedPrincipal{}, domain.ErrUnauthenticated
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return application.AuthenticatedPrincipal{}, fmt.Errorf("identity service returned %d", response.StatusCode)
	}
	var payload struct {
		User struct {
			OID   string `json:"oid"`
			Email string `json:"email"`
			Name  string `json:"name"`
		} `json:"user"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 16<<10)).Decode(&payload); err != nil {
		return application.AuthenticatedPrincipal{}, fmt.Errorf("decode identity session: %w", err)
	}
	if payload.User.OID == "" || payload.User.Email == "" || payload.User.Name == "" {
		return application.AuthenticatedPrincipal{}, errors.New("identity service returned an invalid session")
	}
	return application.AuthenticatedPrincipal{OID: payload.User.OID}, nil
}
