package httptransport

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"cgsi-suite/services/authorization-service/internal/application"
	"cgsi-suite/services/authorization-service/internal/domain"
	"cgsi-suite/services/shared/platform/httpjson"
	"cgsi-suite/services/shared/platform/httpserver"
	"cgsi-suite/services/shared/platform/observability"
)

type Handler struct {
	service *application.Service
}

type relationshipRequest struct {
	User     string `json:"user"`
	Relation string `json:"relation"`
	Object   string `json:"object"`
}

func (request relationshipRequest) tuple() domain.Tuple {
	return domain.Tuple{User: request.User, Relation: request.Relation, Object: request.Object}
}

func NewHandler(service *application.Service) http.Handler {
	handler := &Handler{service: service}
	mux := http.NewServeMux()
	mux.Handle("GET /healthz", httpserver.Health("authorization-service", service.Ready))
	mux.HandleFunc("POST /v1/check", handler.check)
	mux.HandleFunc("POST /v1/membership", handler.addMembership)
	mux.HandleFunc("POST /v1/relationships", handler.writeRelationship)
	return httpjson.SecurityHeaders(requireMethods(mux))
}

func (h *Handler) check(w http.ResponseWriter, r *http.Request) {
	if !h.service.TokenAllowed(application.CheckTokenKind, r.Header.Get("X-CGSI-Service-Token")) {
		httpjson.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body relationshipRequest
	if !decodeBody(w, r, &body) || !domain.ValidTuple(body.tuple()) {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid_authorization_tuple")
		return
	}
	allowed, err := h.service.Check(r.Context(), body.tuple())
	if err != nil {
		observability.Log(r.Context(), "ERROR", "authorization_check_failed", map[string]any{"error_type": fmt.Sprintf("%T", err)})
		httpjson.WriteError(w, http.StatusBadGateway, "authorization_check_unavailable")
		return
	}
	httpjson.Write(w, http.StatusOK, map[string]bool{"allowed": allowed})
}

func (h *Handler) addMembership(w http.ResponseWriter, r *http.Request) {
	if !h.service.TokenAllowed(application.ProvisioningTokenKind, r.Header.Get("X-CGSI-Service-Token")) {
		httpjson.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body struct {
		ObjectID string `json:"objectId"`
		GroupKey string `json:"groupKey"`
	}
	if !decodeBody(w, r, &body) || !domain.ValidOrganizationObjectID(body.ObjectID) || body.GroupKey != "all-employees" {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid_organization_identity")
		return
	}
	if err := h.service.AddOrganizationMember(r.Context(), body.ObjectID, body.GroupKey); err != nil {
		observability.Log(r.Context(), "ERROR", "employee_group_write_failed", map[string]any{"error_type": fmt.Sprintf("%T", err)})
		httpjson.WriteError(w, http.StatusBadGateway, "organization_membership_unavailable")
		return
	}
	httpjson.Write(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) writeRelationship(w http.ResponseWriter, r *http.Request) {
	if !h.service.TokenAllowed(application.AdminTokenKind, r.Header.Get("X-CGSI-Service-Token")) {
		httpjson.WriteError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body relationshipRequest
	if !decodeBody(w, r, &body) || !domain.ValidTuple(body.tuple()) {
		httpjson.WriteError(w, http.StatusBadRequest, "invalid_authorization_tuple")
		return
	}
	if err := h.service.WriteRelationship(r.Context(), body.tuple()); err != nil {
		observability.Log(r.Context(), "ERROR", "relationship_write_failed", map[string]any{"error_type": fmt.Sprintf("%T", err)})
		httpjson.WriteError(w, http.StatusBadGateway, "relationship_write_unavailable")
		return
	}
	httpjson.Write(w, http.StatusOK, map[string]string{"status": "ok"})
}

func decodeBody(w http.ResponseWriter, r *http.Request, destination any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 16<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return false
	}
	return decoder.Decode(new(any)) == io.EOF
}

func requireMethods(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" && r.Method == http.MethodGet {
			next.ServeHTTP(w, r)
			return
		}
		if r.Method != http.MethodPost {
			httpjson.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed")
			return
		}
		next.ServeHTTP(w, r)
	})
}
