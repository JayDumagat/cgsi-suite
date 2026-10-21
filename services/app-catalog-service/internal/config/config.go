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
	ERISHref           string
	RDESHref           string
	CDEXAvailable      bool
	BILSAvailable      bool
	ERISAvailable      bool
}

func Load() Config {
	return Config{
		IdentityURL:        strings.TrimRight(envOr("IDENTITY_SERVICE_URL", "http://identity-service:8081"), "/"),
		AuthorizationURL:   strings.TrimRight(envOr("AUTHORIZATION_SERVICE_URL", "http://authorization-service:8083"), "/"),
		AuthorizationToken: os.Getenv("AUTHORIZATION_SERVICE_TOKEN"),
		CDEXHref:           envOr("CDEX_APP_URL", "/crm/"),
		BILSHref:           envOr("BILS_APP_URL", "/billing/"),
		ERISHref:           envOr("ERIS_APP_URL", "/eris/"),
		RDESHref:           envOr("RDES_APP_URL", "/rdes/"),
		CDEXAvailable:      envEnabled("CDEX_APP_AVAILABLE"),
		BILSAvailable:      envEnabled("BILS_APP_AVAILABLE"),
		ERISAvailable:      envEnabled("ERIS_APP_AVAILABLE"),
	}
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func envEnabled(name string) bool {
	return strings.EqualFold(os.Getenv(name), "true")
}
