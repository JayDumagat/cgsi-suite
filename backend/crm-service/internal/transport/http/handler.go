package httptransport

import (
	"net/http"

	"cgsi-suite/services/shared/platform/httpjson"
	"cgsi-suite/services/shared/platform/httpserver"
)

type moduleInfo struct {
	Service string `json:"service"`
	Module  string `json:"module"`
	Status  string `json:"status"`
}

func NewHandler() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /healthz", httpserver.Health("crm-service", nil))
	mux.HandleFunc("GET /", func(w http.ResponseWriter, _ *http.Request) {
		httpjson.Write(w, http.StatusOK, moduleInfo{Service: "crm-service", Module: "CDEX", Status: "scaffold"})
	})
	return httpjson.SecurityHeaders(mux)
}
