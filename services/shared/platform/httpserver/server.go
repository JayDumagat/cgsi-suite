package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"cgsi-suite/services/shared/platform/observability"
)

func Port(fallback string) string {
	if value := os.Getenv("PORT"); value != "" {
		if port, err := strconv.Atoi(value); err == nil && port > 0 && port <= 65535 {
			return ":" + value
		}
		log.Fatalf("PORT must be a valid TCP port")
	}
	return ":" + fallback
}

func Serve(handler http.Handler, port, service string) {
	observability.Initialize(service)
	server := &http.Server{
		Addr:              port,
		Handler:           observability.Middleware(service, handler),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	shutdown, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-shutdown.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			observability.Log(ctx, "ERROR", "http_server_shutdown_failed", map[string]any{
				"service": service, "error_type": fmt.Sprintf("%T", err),
			})
		}
	}()

	observability.Log(context.Background(), "INFO", "service_listening", map[string]any{"service": service, "port": port})
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("%s server: %v", service, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	observability.Shutdown(ctx)
}

func Health(service string, ready func() bool) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		status := "ok"
		statusCode := http.StatusOK
		if ready != nil && !ready() {
			status = "starting"
			statusCode = http.StatusServiceUnavailable
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(statusCode)
		_ = json.NewEncoder(w).Encode(map[string]string{"service": service, "status": status})
	}
}
