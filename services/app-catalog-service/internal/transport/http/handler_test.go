package httptransport

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"cgsi-suite/services/app-catalog-service/internal/application"
	"cgsi-suite/services/app-catalog-service/internal/domain"
)

type identityStub struct{ err error }

func (stub identityStub) SessionUser(context.Context, string) (application.AuthenticatedPrincipal, error) {
	return application.AuthenticatedPrincipal{OID: "employee-1"}, stub.err
}

type authorizationStub struct{}

func (authorizationStub) CanAccess(context.Context, string, string) (bool, error) { return false, nil }

func TestListAppsMapsUnauthenticatedSessionTo401(t *testing.T) {
	service := application.NewCatalog(application.Config{}, identityStub{err: domain.ErrUnauthenticated}, authorizationStub{})
	recorder := httptest.NewRecorder()
	NewHandler(service).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/apps", nil))

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
	if recorder.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("private catalog response should not be cached")
	}
}

func TestListAppsReturnsCatalogContract(t *testing.T) {
	service := application.NewCatalog(application.Config{}, identityStub{}, authorizationStub{})
	recorder := httptest.NewRecorder()
	NewHandler(service).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/apps", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	var payload struct {
		Apps []appResponse `json:"apps"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Apps) != 4 || payload.Apps[0].Name != "CDEX" {
		t.Fatalf("unexpected app catalog response: %+v", payload.Apps)
	}
}

func TestInternalAccessDeniesUnavailableApp(t *testing.T) {
	service := application.NewCatalog(application.Config{}, identityStub{}, authorizationStub{})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/internal/app-access", nil)
	request.Header.Set("X-CGSI-App-ID", "crm")
	NewHandler(service).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusForbidden)
	}
}
