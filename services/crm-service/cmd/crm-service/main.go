package main

import (
	httptransport "cgsi-suite/services/crm-service/internal/transport/http"
	"cgsi-suite/services/shared/platform/httpserver"
)

func main() {
	httpserver.Serve(httptransport.NewHandler(), httpserver.Port("8084"), "crm-service")
}
