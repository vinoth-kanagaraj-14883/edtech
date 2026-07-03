// site24x7/kubernetes/apm-agent/go/apm-snippet-notification.go
//
// Site24x7 APM initialization snippet for notification-service (Go/Fiber).
//
// This uses the same OTel-compatible approach as api-gateway.
// See apm-snippet-api-gateway.go for detailed comments.
//
// PREFERRED APPROACH: Use the K8s patch in patch-examples/notification-service-patch.yaml
// to inject OTEL_EXPORTER_OTLP_ENDPOINT without any code changes.

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

// initSite24x7APMNotification configures OTel to export traces to Site24x7
// for the notification-service (Go/Fiber).
//
// Required env vars (set via Kubernetes patch):
//   SITE24X7_APM_KEY        — device key
//   SITE24X7_SERVICE_NAME   — "edtech-notification-service"
func initSite24x7APMNotification(ctx context.Context) (func(context.Context) error, error) {
	deviceKey := os.Getenv("SITE24X7_APM_KEY")
	if deviceKey == "" {
		log.Println("[site24x7] SITE24X7_APM_KEY not set — APM disabled")
		return func(ctx context.Context) error { return nil }, nil
	}

	serviceName := os.Getenv("SITE24X7_SERVICE_NAME")
	if serviceName == "" {
		serviceName = "edtech-notification-service"
	}

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
			semconv.DeploymentEnvironment(getEnvOrDefaultNotification("ENVIRONMENT", "production")),
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

func getEnvOrDefaultNotification(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
