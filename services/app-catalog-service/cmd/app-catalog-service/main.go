package main

import (
	"cgsi-suite/services/app-catalog-service/internal/application"
	"cgsi-suite/services/app-catalog-service/internal/config"
	"cgsi-suite/services/app-catalog-service/internal/infrastructure/authorization"
	"cgsi-suite/services/app-catalog-service/internal/infrastructure/identity"
	httptransport "cgsi-suite/services/app-catalog-service/internal/transport/http"
	"cgsi-suite/services/shared/platform/httpserver"
)

func main() {
	settings := config.Load()
	identityClient := identity.NewClient(settings.IdentityURL)
	authorizationClient := authorization.NewClient(settings.AuthorizationURL, settings.AuthorizationToken)
	catalog := application.NewCatalog(application.Config{
		CDEXHref:      settings.CDEXHref,
		BILSHref:      settings.BILSHref,
		ERISHref:      settings.ERISHref,
		RDESHref:      settings.RDESHref,
		CDEXAvailable: settings.CDEXAvailable,
		BILSAvailable: settings.BILSAvailable,
		ERISAvailable: settings.ERISAvailable,
	}, identityClient, authorizationClient)
	httpserver.Serve(httptransport.NewHandler(catalog), httpserver.Port("8082"), "app-catalog-service")
}
