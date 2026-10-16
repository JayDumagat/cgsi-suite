package authorization

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (roundTrip roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return roundTrip(request)
}

func TestCanAccessSendsServiceTokenAndRelationship(t *testing.T) {
	client := NewClient("http://authorization.test", "service-token")
	client.http = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.Method != http.MethodPost || request.URL.Path != "/v1/check" {
			t.Errorf("unexpected request: %s %s", request.Method, request.URL.Path)
		}
		if got := request.Header.Get("X-CGSI-Service-Token"); got != "service-token" {
			t.Errorf("service token = %q", got)
		}
		var body map[string]string
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		if body["user"] != "user:entra-oid" || body["relation"] != "can_access" || body["object"] != "app:crm" {
			t.Errorf("relationship body = %#v", body)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(`{"allowed":true}`)),
			Request:    request,
		}, nil
	})}

	allowed, err := client.CanAccess(context.Background(), "entra-oid", "app:crm")
	if err != nil || !allowed {
		t.Fatalf("CanAccess() = %v, %v; want true, nil", allowed, err)
	}
}

func TestCanAccessRejectsMalformedDecision(t *testing.T) {
	client := NewClient("http://authorization.test", "service-token")
	client.http = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(`{}`)),
			Request:    request,
		}, nil
	})}

	if _, err := client.CanAccess(context.Background(), "entra-oid", "app:crm"); err == nil {
		t.Fatal("missing allowed decision was accepted")
	}
}
