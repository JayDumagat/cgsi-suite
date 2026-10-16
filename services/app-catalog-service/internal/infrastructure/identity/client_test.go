package identity

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	"cgsi-suite/services/app-catalog-service/internal/domain"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (roundTrip roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return roundTrip(request)
}

func fakeResponse(request *http.Request, status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    request,
	}
}

func TestSessionUserForwardsCookieAndReadsPrincipal(t *testing.T) {
	client := NewClient("http://identity.test")
	client.http = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.Method != http.MethodGet || request.URL.Path != "/api/auth/session" {
			t.Errorf("unexpected request: %s %s", request.Method, request.URL.Path)
		}
		if got := request.Header.Get("Cookie"); got != "cgsi_session=session-value" {
			t.Errorf("Cookie header = %q", got)
		}
		return fakeResponse(request, http.StatusOK, `{"authenticated":true,"user":{"oid":"entra-oid","email":"person@example.com","name":"Person"}}`), nil
	})}

	principal, err := client.SessionUser(context.Background(), "cgsi_session=session-value")
	if err != nil {
		t.Fatal(err)
	}
	if principal.OID != "entra-oid" {
		t.Fatalf("OID = %q, want entra-oid", principal.OID)
	}
}

func TestSessionUserMaps401ToUnauthenticated(t *testing.T) {
	client := NewClient("http://identity.test")
	client.http = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		return fakeResponse(request, http.StatusUnauthorized, ""), nil
	})}

	_, err := client.SessionUser(context.Background(), "")
	if !errors.Is(err, domain.ErrUnauthenticated) {
		t.Fatalf("error = %v, want ErrUnauthenticated", err)
	}
}

func TestSessionUserRejectsIncompletePrincipal(t *testing.T) {
	client := NewClient("http://identity.test")
	client.http = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		return fakeResponse(request, http.StatusOK, `{"user":{"oid":""}}`), nil
	})}

	if _, err := client.SessionUser(context.Background(), ""); err == nil {
		t.Fatal("incomplete session principal was accepted")
	}
}
