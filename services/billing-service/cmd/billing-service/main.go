package main

import (
	httptransport "cgsi-suite/services/billing-service/internal/transport/http"
	"cgsi-suite/services/shared/platform/httpserver"
)

func main() {
	httpserver.Serve(httptransport.NewHandler(), httpserver.Port("8085"), "billing-service")
}
