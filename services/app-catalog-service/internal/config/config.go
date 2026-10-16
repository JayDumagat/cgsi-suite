package config

import (
	"os"
	"strings"
)

type Config struct {
	IdentityURL        string
	AuthorizationURL   string
	AuthorizationToken string
	CDEXHref           string
	BILSHref           string
	HUMAHref           string
	RDESHref           string
}

func Load() Config {
	return Config{
		IdentityURL:        strings.TrimRight(envOr("IDENTITY_SERVICE_URL", "http://identity-service:8081"), "/"),
		AuthorizationURL:   strings.TrimRight(envOr("AUTHORIZATION_SERVICE_URL", "http://authorization-service:8083"), "/"),
		AuthorizationToken: os.Getenv("AUTHORIZATION_SERVICE_TOKEN"),
		CDEXHref:           envOr("CDEX_APP_URL", "/crm/"),
		BILSHref:           envOr("BILS_APP_URL", "/billing/"),
		HUMAHref:           envOr("HUMA_APP_URL", "/huma/"),
		RDESHref:           envOr("RDES_APP_URL", "/rdes/"),
	}
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
