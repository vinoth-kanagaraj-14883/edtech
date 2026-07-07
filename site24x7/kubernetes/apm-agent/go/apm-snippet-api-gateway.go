// site24x7/kubernetes/apm-agent/go/apm-snippet-api-gateway.go
//
// Site24x7 APM initialization snippet for api-gateway (Go/Gin).
//
// USAGE: This snippet shows how to configure OTel to export to Site24x7.
// The api-gateway already uses OTel — add these environment variable
// overrides (via K8s patch) and optionally call initSite24x7APM() from main().
//
// PREFERRED APPROACH: Use the K8s patch in patch-examples/api-gateway-patch.yaml
// to inject OTEL_EXPORTER_OTLP_ENDPOINT without any code changes.
//
// If you prefer explicit SDK initialization, copy this snippet into the
// api-gateway's main.go or a dedicated apm.go file.

package main

import (
	"context"
	"log"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"google.golang.org/grpc/credentials"
)

// initSite24x7APM configures OpenTelemetry to export traces to Site24x7.
// Call this from main() before starting the Gin router.
//
// Required environment variables (set via Kubernetes patch):
//   SITE24X7_APM_KEY     — your Site24x7 device key
//   SITE24X7_SERVICE_NAME — service name shown in Site24x7 portal (default: edtech-api-gateway)
func initSite24x7APM(ctx context.Context) (func(context.Context) error, error) {
	deviceKey := os.Getenv("SITE24X7_APM_KEY")
	if deviceKey == "" {
		log.Println("[site24x7] SITE24X7_APM_KEY not set — APM disabled")
		return func(ctx context.Context) error { return nil }, nil
	}

	serviceName := os.Getenv("SITE24X7_SERVICE_NAME")
	if serviceName == "" {
		serviceName = "edtech-api-gateway"
	}

	// Site24x7 OTel-compatible OTLP endpoint
	endpoint := "otlp.site24x7.com:4317"
	if ep := os.Getenv("SITE24X7_OTLP_ENDPOINT"); ep != "" {
		endpoint = ep
	}

	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(endpoint),
		otlptracegrpc.WithTLSCredentials(credentials.NewClientTLSFromCert(nil, "")),
		otlptracegrpc.WithHeaders(map[string]string{
			"device-key": deviceKey,
		}),
	)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion("1.0.0"),
			semconv.DeploymentEnvironment(getEnvOrDefault("ENVIRONMENT", "production")),
		),
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)

	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	log.Printf("[site24x7] APM initialized for service=%s endpoint=%s", serviceName, endpoint)
	return tp.Shutdown, nil
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

// Example main() integration:
//
// func main() {
//     ctx := context.Background()
//     shutdown, err := initSite24x7APM(ctx)
//     if err != nil {
//         log.Fatalf("failed to init Site24x7 APM: %v", err)
//     }
//     defer shutdown(ctx)
//
//     router := gin.New()
//     router.Use(otelgin.Middleware("edtech-api-gateway"))
//     // ... rest of setup
// }
