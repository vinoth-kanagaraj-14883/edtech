package main

import (
	"context"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// The api-gateway injects application chaos for services that do NOT carry an
// in-service chaos hook (course-service/Java, quiz-service/Ruby, plus the
// user/notification/search services). It reads the same Redis chaos-flag
// contract every EduForge service uses — chaos:latency:<svc> (ms) and
// chaos:error:<svc> (0-100 %) — and applies the fault on the proxied request,
// so the fault appears on the gateway→service span and the service's RED
// metrics degrade. Services that self-inject (payment, tracking, certification,
// content) are intentionally NOT gateway-injected to avoid double application.

// upstreamToChaosService maps the gateway's internal upstream key to the
// canonical service name used in the chaos flags / OTel service.name.
var upstreamToChaosService = map[string]string{
	"users":         "user-service",
	"courses":       "course-service",
	"content":       "content-service",
	"quizzes":       "quiz-service",
	"notifications": "notification-service",
	"search":        "search-service",
	"payments":      "payment-service",
	"tracking":      "tracking-service",
	"certificates":  "certification-service",
}

// gatewayInjectedServices is the set of services whose latency/error faults the
// gateway applies on their behalf (they have no in-service hook).
var gatewayInjectedServices = map[string]bool{
	"user-service":         true,
	"course-service":       true,
	"quiz-service":         true,
	"notification-service": true,
	"search-service":       true,
}

// gatewayChaosServiceName is the flag namespace for gateway-wide chaos applied
// to every inbound request (a "gateway brownout").
const gatewayChaosServiceName = "api-gateway"

type serviceChaos struct {
	latencyMs int
	errorPct  int
}

// ChaosController polls the Redis chaos flags for a fixed set of services and
// caches them in memory so the request hot path never touches Redis. It is
// fail-open: if Redis is unreachable, all flags read as zero (no chaos).
type ChaosController struct {
	redis    *redis.Client
	services []string
	interval time.Duration

	mu    sync.RWMutex
	state map[string]serviceChaos
}

// NewChaosController builds a controller polling api-gateway plus every
// gateway-injected service.
func NewChaosController(rc *redis.Client) *ChaosController {
	services := []string{gatewayChaosServiceName}
	for svc := range gatewayInjectedServices {
		services = append(services, svc)
	}
	return &ChaosController{
		redis:    rc,
		services: services,
		interval: 3 * time.Second,
		state:    make(map[string]serviceChaos),
	}
}

// Start launches the background polling loop until ctx is cancelled.
func (c *ChaosController) Start(ctx context.Context) {
	if c == nil || c.redis == nil {
		return
	}
	go func() {
		ticker := time.NewTicker(c.interval)
		defer ticker.Stop()
		c.poll(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				c.poll(ctx)
			}
		}
	}()
}

func (c *ChaosController) poll(ctx context.Context) {
	keys := make([]string, 0, len(c.services)*2)
	for _, svc := range c.services {
		keys = append(keys, "chaos:latency:"+svc, "chaos:error:"+svc)
	}

	pctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	vals, err := c.redis.MGet(pctx, keys...).Result()
	if err != nil {
		// Fail open: drop all chaos while Redis is unavailable.
		c.mu.Lock()
		c.state = make(map[string]serviceChaos)
		c.mu.Unlock()
		return
	}

	newState := make(map[string]serviceChaos, len(c.services))
	for i, svc := range c.services {
		latency := parseFlagValue(vals[i*2])
		errPct := parseFlagValue(vals[i*2+1])
		if errPct > 100 {
			errPct = 100
		}
		newState[svc] = serviceChaos{latencyMs: latency, errorPct: errPct}
	}

	c.mu.Lock()
	c.state = newState
	c.mu.Unlock()
}

func (c *ChaosController) get(service string) serviceChaos {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.state[service]
}

// apply injects latency and (probabilistically) an error for the named service.
// It returns true if the request was aborted with a 503 and must not proceed.
func (c *ChaosController) apply(ctx *gin.Context, service string) bool {
	if c == nil {
		return false
	}
	sc := c.get(service)

	if sc.latencyMs > 0 {
		markChaosSpan(ctx, "latency")
		// Jitter the delay rather than sleeping a constant amount. A flat delay
		// is obviously synthetic and collapses p50 onto p99; spreading it makes
		// the latency histogram look like a genuinely degraded dependency.
		jittered := float64(sc.latencyMs) * (0.55 + rand.Float64()*1.20)
		time.Sleep(time.Duration(jittered) * time.Millisecond)
	}

	if sc.errorPct > 0 && rand.Intn(100) < sc.errorPct {
		markChaosSpan(ctx, "error")
		ctx.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
			"error": "chaos: injected failure",
			"chaos": true,
		})
		return true
	}

	return false
}

func markChaosSpan(ctx *gin.Context, kind string) {
	span := trace.SpanFromContext(ctx.Request.Context())
	if span != nil {
		span.SetAttributes(attribute.String("chaos.injected", kind))
	}
}

// gatewayChaosMiddleware applies gateway-wide chaos (chaos:*:api-gateway) to
// every request, so a single flag can "brown out" the whole platform edge.
func gatewayChaosMiddleware(c *ChaosController) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		path := ctx.Request.URL.Path
		if path == "/health" || path == "/ready" || path == "/metrics" {
			ctx.Next()
			return
		}
		if c.apply(ctx, gatewayChaosServiceName) {
			return
		}
		ctx.Next()
	}
}

func parseFlagValue(v interface{}) int {
	s, ok := v.(string)
	if !ok {
		return 0
	}
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil || n < 0 {
		return 0
	}
	return n
}
