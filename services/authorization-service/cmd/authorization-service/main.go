package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"cgsi-suite/services/authorization-service/internal/application"
	"cgsi-suite/services/authorization-service/internal/config"
	"cgsi-suite/services/authorization-service/internal/infrastructure/openfga"
	httptransport "cgsi-suite/services/authorization-service/internal/transport/http"
	"cgsi-suite/services/shared/platform/httpserver"
	"cgsi-suite/services/shared/platform/observability"
)

func main() {
	observability.Initialize("authorization-service")
	settings := config.Load()
	openFGA := openfga.NewClient(settings.OpenFGAURL)
	service := application.NewService(application.Config{
		CheckToken:        settings.CheckToken,
		ProvisioningToken: settings.ProvisioningToken,
		AdminToken:        settings.AdminToken,
	}, openFGA)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := service.Bootstrap(ctx); err != nil {
		observability.Log(ctx, "ERROR", "authorization_bootstrap_failed", map[string]any{"error_type": fmt.Sprintf("%T", err)})
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 2*time.Second)
		observability.Shutdown(shutdownCtx)
		shutdownCancel()
		os.Exit(1)
	}
	httpserver.Serve(httptransport.NewHandler(service), httpserver.Port("8083"), "authorization-service")
}
