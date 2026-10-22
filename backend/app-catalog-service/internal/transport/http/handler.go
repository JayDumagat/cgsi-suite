package httptransport

import (
	"errors"
	"fmt"
	"net/http"

	"cgsi-suite/services/app-catalog-service/internal/application"
	"cgsi-suite/services/app-catalog-service/internal/domain"
	"cgsi-suite/services/shared/platform/httpjson"
	"cgsi-suite/services/shared/platform/httpserver"
	"cgsi-suite/services/shared/platform/observability"
)

type appResponse struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Href        string `json:"href"`
	Initials    string `json:"initials"`
	Accent      string `json:"accent"`
	Status      string `json:"status"`
	CanAccess   bool   `json:"canAccess"`
}

func toAppResponse(app domain.App) appResponse {
	return appResponse{
		ID: app.ID, Name: app.Name, Description: app.Description, Href: app.Href,
		Initials: app.Initials, Accent: app.Accent, Status: string(app.Status), CanAccess: app.CanAccess,
	}
}

type Handler struct {
	service *application.Catalog
}

func NewHandler(service *application.Catalog) http.Handler {
	handler := &Handler{service: service}
	mux := http.NewServeMux()
	mux.Handle("GET /healthz", httpserver.Health("app-catalog-service", nil))
	mux.HandleFunc("GET /api/v1/apps", handler.listApps)
	mux.HandleFunc("GET /internal/app-access", handler.checkAppAccess)
	return httpjson.SecurityHeaders(mux)
}

func (h *Handler) listApps(w http.ResponseWriter, r *http.Request) {
	apps, err := h.service.ListApps(r.Context(), r.Header.Get("Cookie"))
	if err != nil {
		if errors.Is(err, domain.ErrUnauthenticated) {
			httpjson.WriteError(w, http.StatusUnauthorized, "unauthenticated")
			return
		}
		observability.Log(r.Context(), "ERROR", "catalog_request_failed", map[string]any{"error_type": fmt.Sprintf("%T", err)})
		httpjson.WriteError(w, http.StatusBadGateway, "catalog_unavailable")
		return
	}
	response := make([]appResponse, 0, len(apps))
	for _, app := range apps {
		response = append(response, toAppResponse(app))
	}
	httpjson.Write(w, http.StatusOK, map[string]any{"apps": response})
}

func (h *Handler) checkAppAccess(w http.ResponseWriter, r *http.Request) {
	err := h.service.CheckAppAccess(r.Context(), r.Header.Get("Cookie"), r.Header.Get("X-CGSI-App-ID"))
	if err == nil {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if errors.Is(err, domain.ErrUnauthenticated) {
		httpjson.WriteError(w, http.StatusUnauthorized, "unauthenticated")
		return
	}
	if errors.Is(err, domain.ErrForbidden) {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	observability.Log(r.Context(), "ERROR", "app_access_check_failed", map[string]any{"error_type": fmt.Sprintf("%T", err)})
	httpjson.WriteError(w, http.StatusBadGateway, "authorization_unavailable")
}
