package httptransport

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthAndModuleEndpoints(t *testing.T) {
	handler := NewHandler()
	for _, route := range []struct {
		path string
		want int
	}{
		{path: "/healthz", want: http.StatusOK},
		{path: "/", want: http.StatusOK},
	} {
		t.Run(route.path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, route.path, nil))
			if recorder.Code != route.want {
				t.Fatalf("status = %d, want %d", recorder.Code, route.want)
			}
		})
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	var payload moduleInfo
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Module != "BILS" || payload.Status != "scaffold" {
		t.Fatalf("unexpected module response: %+v", payload)
	}
}
