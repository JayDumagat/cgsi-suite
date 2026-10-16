package observability

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type traceContextKey struct{}

type traceContext struct {
	traceID      string
	spanID       string
	parentSpanID string
}

type metricKey struct {
	method      string
	statusClass string
}

type httpMetric struct {
	count    uint64
	duration float64
	buckets  [10]uint64
}

type telemetry struct {
	service    string
	endpoint   string
	startedAt  int64
	spans      chan map[string]any
	logs       chan map[string]any
	metricsMu  sync.Mutex
	metrics    map[metricKey]*httpMetric
	stop       chan struct{}
	done       chan struct{}
	stopOnce   sync.Once
	httpClient *http.Client
}

var (
	current  *telemetry
	initOnce sync.Once
)

var durationBounds = [...]float64{5, 10, 25, 50, 100, 250, 500, 1000, 5000}

func Initialize(service string) {
	initOnce.Do(func() {
		serviceName := os.Getenv("OTEL_SERVICE_NAME")
		if serviceName == "" {
			serviceName = service
		}
		endpoint := strings.TrimRight(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"), "/")
		if endpoint == "" {
			endpoint = "http://otel-collector:4318"
		}
		current = &telemetry{
			service:    serviceName,
			endpoint:   endpoint,
			startedAt:  time.Now().UnixNano(),
			spans:      make(chan map[string]any, 1024),
			logs:       make(chan map[string]any, 1024),
			metrics:    make(map[metricKey]*httpMetric),
			stop:       make(chan struct{}),
			done:       make(chan struct{}),
			httpClient: &http.Client{Timeout: 2 * time.Second},
		}
		go current.run()
	})
}

func Middleware(service string, next http.Handler) http.Handler {
	Initialize(service)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		parent := parseTraceparent(r.Header.Get("traceparent"))
		span := traceContext{traceID: randomID(16), spanID: randomID(8)}
		if parent != nil {
			span.traceID = parent.traceID
			span.parentSpanID = parent.spanID
		}
		ctx := context.WithValue(r.Context(), traceContextKey{}, span)
		start := time.Now()
		writer := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(writer, r.WithContext(ctx))
		duration := float64(time.Since(start).Microseconds()) / 1000
		method := normalizeMethod(r.Method)
		statusClass := fmt.Sprintf("%dxx", writer.status/100)
		current.record(method, statusClass, duration)
		current.queueSpan(map[string]any{
			"traceId":           otlpID(span.traceID),
			"spanId":            otlpID(span.spanID),
			"parentSpanId":      otlpID(span.parentSpanID),
			"name":              method + " " + service,
			"kind":              2,
			"startTimeUnixNano": fmt.Sprint(start.UnixNano()),
			"endTimeUnixNano":   fmt.Sprint(time.Now().UnixNano()),
			"attributes": []map[string]any{
				stringAttribute("http.request.method", method),
				stringAttribute("http.route", service),
				intAttribute("http.response.status_code", writer.status),
				doubleAttribute("http.server.duration", duration),
			},
			"status": map[string]int{"code": statusCode(writer.status)},
		})
		severity := "INFO"
		if writer.status >= 500 {
			severity = "ERROR"
		} else if writer.status >= 400 {
			severity = "WARN"
		}
		Log(ctx, severity, "http_request", map[string]any{
			"service": service, "http_method": method, "http_route": service,
			"http_status_code": writer.status, "duration_ms": duration,
		})
	})
}

func Log(ctx context.Context, severity, message string, fields map[string]any) {
	if current == nil {
		writeConsoleLog(severity, message, fields, "")
		return
	}
	trace, _ := ctx.Value(traceContextKey{}).(traceContext)
	allowed := map[string]bool{
		"service": true, "port": true, "signal": true, "error_type": true,
		"http_method": true, "http_route": true, "http_status_code": true, "duration_ms": true,
	}
	attributes := make([]map[string]any, 0, len(fields))
	safeFields := make(map[string]any)
	for key, value := range fields {
		if allowed[key] {
			attributes = append(attributes, anyAttribute(key, value))
			safeFields[key] = value
		}
	}
	writeConsoleLog(severity, message, safeFields, trace.traceID)
	severityText, severityNumber := severityLevel(severity)
	entry := map[string]any{
		"timeUnixNano":         fmt.Sprint(time.Now().UnixNano()),
		"observedTimeUnixNano": fmt.Sprint(time.Now().UnixNano()),
		"severityNumber":       severityNumber,
		"severityText":         severityText,
		"body":                 map[string]string{"stringValue": message},
		"attributes":           attributes,
	}
	if trace.traceID != "" {
		entry["traceId"] = otlpID(trace.traceID)
		entry["spanId"] = otlpID(trace.spanID)
	}
	current.queueLog(entry)
}

func InjectTraceContext(ctx context.Context, request *http.Request) {
	if trace, ok := ctx.Value(traceContextKey{}).(traceContext); ok {
		request.Header.Set("traceparent", "00-"+trace.traceID+"-"+trace.spanID+"-01")
	}
}

func Shutdown(ctx context.Context) {
	if current == nil {
		return
	}
	current.stopOnce.Do(func() { close(current.stop) })
	select {
	case <-current.done:
	case <-ctx.Done():
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
	wrote  bool
}

func (w *statusWriter) WriteHeader(status int) {
	if w.wrote {
		return
	}
	w.status = status
	w.wrote = true
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusWriter) Write(data []byte) (int, error) {
	if !w.wrote {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(data)
}

func (t *telemetry) record(method, statusClass string, duration float64) {
	t.metricsMu.Lock()
	defer t.metricsMu.Unlock()
	key := metricKey{method: method, statusClass: statusClass}
	metric := t.metrics[key]
	if metric == nil {
		metric = &httpMetric{}
		t.metrics[key] = metric
	}
	metric.count++
	metric.duration += duration
	for index, bound := range durationBounds {
		if duration <= bound {
			metric.buckets[index]++
			return
		}
	}
	metric.buckets[len(durationBounds)]++
}

func (t *telemetry) queueSpan(span map[string]any) {
	select {
	case t.spans <- span:
	default:
	}
}

func (t *telemetry) queueLog(entry map[string]any) {
	select {
	case t.logs <- entry:
	default:
	}
}

func (t *telemetry) run() {
	defer close(t.done)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			t.flush()
		case <-t.stop:
			t.flush()
			return
		}
	}
}

func (t *telemetry) flush() {
	spans := drain(t.spans, 100)
	logs := drain(t.logs, 100)
	if len(spans) > 0 {
		t.export("traces", map[string]any{"resourceSpans": []any{t.resourceGroup("scopeSpans", "spans", spans)}})
	}
	if len(logs) > 0 {
		t.export("logs", map[string]any{"resourceLogs": []any{t.resourceGroup("scopeLogs", "logRecords", logs)}})
	}
	metrics := t.metricSnapshot()
	if len(metrics) > 0 {
		t.export("metrics", map[string]any{"resourceMetrics": []any{t.metricGroup(metrics)}})
	}
}

func (t *telemetry) resourceGroup(scopeKey, itemKey string, items []map[string]any) map[string]any {
	scopeItems := map[string]any{"scope": map[string]string{"name": "cgsi-suite"}, itemKey: items}
	return map[string]any{
		"resource": map[string]any{"attributes": []any{
			stringAttribute("service.name", t.service),
			stringAttribute("deployment.environment.name", envOr("OTEL_DEPLOYMENT_ENVIRONMENT", "development")),
		}},
		scopeKey: []any{scopeItems},
	}
}

func (t *telemetry) metricSnapshot() map[metricKey]httpMetric {
	t.metricsMu.Lock()
	defer t.metricsMu.Unlock()
	snapshot := make(map[metricKey]httpMetric, len(t.metrics))
	for key, value := range t.metrics {
		snapshot[key] = *value
	}
	return snapshot
}

func (t *telemetry) metricGroup(series map[metricKey]httpMetric) map[string]any {
	now := fmt.Sprint(time.Now().UnixNano())
	counters := make([]any, 0, len(series))
	histograms := make([]any, 0, len(series))
	for key, metric := range series {
		attributes := []any{
			stringAttribute("http.request.method", key.method),
			stringAttribute("http.response.status_class", key.statusClass),
		}
		counters = append(counters, map[string]any{
			"startTimeUnixNano": fmt.Sprint(t.startedAt), "timeUnixNano": now,
			"asInt": fmt.Sprint(metric.count), "attributes": attributes,
		})
		bucketCounts := make([]string, len(metric.buckets))
		for index, count := range metric.buckets {
			bucketCounts[index] = fmt.Sprint(count)
		}
		histograms = append(histograms, map[string]any{
			"startTimeUnixNano": fmt.Sprint(t.startedAt), "timeUnixNano": now,
			"count": fmt.Sprint(metric.count), "sum": metric.duration,
			"explicitBounds": durationBounds[:], "bucketCounts": bucketCounts,
			"attributes": attributes,
		})
	}
	resourceMetrics := t.resourceGroup("scopeMetrics", "metrics", []map[string]any{
		{"name": "http.server.request.count", "unit": "{request}", "sum": map[string]any{
			"aggregationTemporality": 2, "isMonotonic": true, "dataPoints": counters,
		}},
		{"name": "http.server.duration", "unit": "ms", "histogram": map[string]any{
			"aggregationTemporality": 2, "dataPoints": histograms,
		}},
	})
	return resourceMetrics
}

func (t *telemetry) export(signal string, payload map[string]any) {
	body, err := json.Marshal(payload)
	if err != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, t.endpoint+"/v1/"+signal, strings.NewReader(string(body)))
	if err != nil {
		return
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := t.httpClient.Do(request)
	if err != nil {
		return
	}
	_ = response.Body.Close()
}

func drain(queue chan map[string]any, limit int) []map[string]any {
	items := make([]map[string]any, 0, limit)
	for len(items) < limit {
		select {
		case item := <-queue:
			items = append(items, item)
		default:
			return items
		}
	}
	return items
}

func parseTraceparent(value string) *traceContext {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(value)), "-")
	if len(parts) != 4 || parts[0] != "00" || len(parts[1]) != 32 || len(parts[2]) != 16 || len(parts[3]) != 2 {
		return nil
	}
	if _, err := hex.DecodeString(parts[1]); err != nil {
		return nil
	}
	if _, err := hex.DecodeString(parts[2]); err != nil || strings.Trim(parts[1], "0") == "" || strings.Trim(parts[2], "0") == "" {
		return nil
	}
	return &traceContext{traceID: parts[1], parentSpanID: parts[2]}
}

func randomID(byteCount int) string {
	value := make([]byte, byteCount)
	if _, err := rand.Read(value); err != nil {
		return strings.Repeat("0", byteCount*2)
	}
	return hex.EncodeToString(value)
}

func otlpID(value string) string {
	decoded, err := hex.DecodeString(value)
	if err != nil {
		return ""
	}
	return base64.StdEncoding.EncodeToString(decoded)
}

func normalizeMethod(method string) string {
	switch method {
	case http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodHead, http.MethodOptions:
		return method
	default:
		return "OTHER"
	}
}

func stringAttribute(key, value string) map[string]any {
	return map[string]any{"key": key, "value": map[string]string{"stringValue": value}}
}

func intAttribute(key string, value int) map[string]any {
	return map[string]any{"key": key, "value": map[string]string{"intValue": fmt.Sprint(value)}}
}

func doubleAttribute(key string, value float64) map[string]any {
	return map[string]any{"key": key, "value": map[string]float64{"doubleValue": value}}
}

func anyAttribute(key string, value any) map[string]any {
	switch typed := value.(type) {
	case string:
		return stringAttribute(key, typed)
	case int:
		return intAttribute(key, typed)
	case int64:
		return intAttribute(key, int(typed))
	case float64:
		return doubleAttribute(key, typed)
	default:
		return stringAttribute(key, "unsupported")
	}
}

func severityLevel(value string) (string, int) {
	switch strings.ToUpper(value) {
	case "ERROR":
		return "ERROR", 17
	case "WARN", "WARNING":
		return "WARN", 13
	default:
		return "INFO", 9
	}
}

func writeConsoleLog(severity, message string, fields map[string]any, traceID string) {
	level, _ := severityLevel(severity)
	record := map[string]any{"timestamp": time.Now().UTC().Format(time.RFC3339Nano), "level": strings.ToLower(level), "message": message}
	if traceID != "" {
		record["trace_id"] = traceID
	}
	for key, value := range fields {
		record[key] = value
	}
	encoded, err := json.Marshal(record)
	if err == nil {
		fmt.Fprintln(os.Stdout, string(encoded))
	}
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func statusCode(status int) int {
	if status >= 500 {
		return 2
	}
	return 1
}
