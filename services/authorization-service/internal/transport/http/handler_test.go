package httptransport

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"cgsi-suite/services/authorization-service/internal/application"
	"cgsi-suite/services/authorization-service/internal/domain"
)

type openFGAStub struct{}

func (openFGAStub) EnsureStore(context.Context, string) (string, error) { return "store-1", nil }
func (openFGAStub) EnsureModel(context.Context, string) (string, error) { return "model-1", nil }
func (openFGAStub) Check(context.Context, string, string, domain.Tuple) (bool, error) {
	return true, nil
}
func (openFGAStub) Write(context.Context, string, string, domain.Tuple) error { return nil }

func newReadyHandler(t *testing.T) http.Handler {
	t.Helper()
	service := application.NewService(application.Config{CheckToken: "check-secret"}, openFGAStub{})
	if err := service.Bootstrap(context.Background()); err != nil {
		t.Fatal(err)
	}
	return NewHandler(service)
}

func TestCheckRequiresServiceToken(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/check", strings.NewReader(`{"user":"user:employee-1","relation":"viewer","object":"app:crm"}`))
	newReadyHandler(t).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
}

func TestCheckReturnsAllowedDecisionForValidRequest(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/check", strings.NewReader(`{"user":"user:employee-1","relation":"viewer","object":"app:crm"}`))
	request.Header.Set("X-CGSI-Service-Token", "check-secret")
	request.Header.Set("Content-Type", "application/json")
	newReadyHandler(t).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	var result map[string]bool
	if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if !result["allowed"] {
		t.Fatal("expected allowed=true")
	}
}

func TestCheckRejectsUnknownJSONFields(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/check", strings.NewReader(`{"user":"user:employee-1","relation":"viewer","object":"app:crm","debug":true}`))
	request.Header.Set("X-CGSI-Service-Token", "check-secret")
	newReadyHandler(t).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
}

func TestCheckRejectsMethodOtherThanPost(t *testing.T) {
	recorder := httptest.NewRecorder()
	newReadyHandler(t).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/v1/check", nil))

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusMethodNotAllowed)
	}
}
