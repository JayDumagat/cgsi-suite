package config

import (
	"os"
	"strings"
)

type Config struct {
	OpenFGAURL        string
	CheckToken        string
	ProvisioningToken string
	AdminToken        string
}

func Load() Config {
	return Config{
		OpenFGAURL:        strings.TrimRight(envOr("OPENFGA_URL", "http://openfga:8080"), "/"),
		CheckToken:        os.Getenv("AUTHORIZATION_SERVICE_TOKEN"),
		ProvisioningToken: os.Getenv("IDENTITY_PROVISIONING_TOKEN"),
		AdminToken:        os.Getenv("AUTHORIZATION_ADMIN_TOKEN"),
	}
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
