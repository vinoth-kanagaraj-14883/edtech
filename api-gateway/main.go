package main

import (
	"bytes"
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

const (
	serviceName         = "api-gateway"
	defaultPort         = "8080"
	defaultRedisAddr    = "redis:6379"
	defaultOTelEndpoint = "otel-collector:4317"
	requestsPerMinute   = 100
)

var (
	requestCounter *prometheus.CounterVec
	requestLatency *prometheus.HistogramVec
	activeRequests prometheus.Gauge
	metricsOnce    sync.Once

	errCircuitOpen = errors.New("upstream circuit breaker is open")
)

type Config struct {
	Port                    string
	RedisAddr               string
	RedisPassword           string
	RedisDB                 int
	OTelEndpoint            string
	CORSAllowedOrigins      []string
	JWTIssuer               string
	JWTAudience             string
	JWTHMACSecret           string
	JWTRSAPublicKey         string
	Upstreams               map[string]string
	RetryMaxAttempts        int
	RetryBaseBackoff        time.Duration
	RetryMaxBackoff         time.Duration
	CircuitFailureThreshold int
	CircuitHalfOpenSuccess  int
	CircuitOpenTimeout      time.Duration
	ProxyTimeout            time.Duration
	ShutdownTimeout         time.Duration
}

type JWTValidator struct {
	hmacSecret []byte
	rsaKey     *rsa.PublicKey
	issuer     string
	audience   string
}

type RedisRateLimiter struct {
	client      *redis.Client
	script      *redis.Script
	capacity    float64
	refillPerMs float64
	keyTTL      time.Duration
	window      time.Duration
}

type circuitState int

const (
	circuitClosed circuitState = iota
	circuitOpen
	circuitHalfOpen
)

type CircuitBreaker struct {
	mu                sync.Mutex
	state             circuitState
	failures          int
	halfOpenSuccesses int
	failureThreshold  int
	successThreshold  int
	openTimeout       time.Duration
	openedAt          time.Time
}

type ResilientTransport struct {
	base        http.RoundTripper
	breaker     *CircuitBreaker
	logger      *zap.Logger
	service     string
	maxAttempts int
	baseBackoff time.Duration
	maxBackoff  time.Duration
}

func main() {
	config := loadConfig()
	logger := newLogger()
	defer func() {
		_ = logger.Sync()
	}()

	tracerProvider, err := initTracerProvider(context.Background(), config)
	if err != nil {
		logger.Fatal("failed to initialize tracing", zap.Error(err))
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), config.ShutdownTimeout)
		defer cancel()
		if err := tracerProvider.Shutdown(shutdownCtx); err != nil {
			logger.Error("failed to shutdown tracer provider", zap.Error(err))
		}
	}()

	redisClient := redis.NewClient(&redis.Options{
		Addr:         config.RedisAddr,
		Password:     config.RedisPassword,
		DB:           config.RedisDB,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolTimeout:  4 * time.Second,
	})
	defer func() {
		if err := redisClient.Close(); err != nil {
			logger.Error("failed to close redis client", zap.Error(err))
		}
	}()

	validator, err := newJWTValidator(config)
	if err != nil {
		logger.Fatal("failed to initialize jwt validator", zap.Error(err))
	}

	initMetrics()

	ginMode := os.Getenv("GIN_MODE")
	if ginMode == "" {
		ginMode = gin.ReleaseMode
	}
	gin.SetMode(ginMode)

	router := gin.New()
	router.Use(recoveryMiddleware(logger))
	router.Use(otelgin.Middleware(serviceName))
	router.Use(corsMiddleware(config.CORSAllowedOrigins))
	router.Use(metricsMiddleware())
	router.Use(loggingMiddleware(logger))
	router.Use(authMiddleware(validator))
	router.Use(rateLimitMiddleware(NewRedisRateLimiter(redisClient, requestsPerMinute, time.Minute), logger))
	router.Use(retryBufferMiddleware(2 << 20))

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	router.GET("/ready", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := redisClient.Ping(ctx).Err(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "degraded", "dependency": "redis", "error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	for service, target := range config.Upstreams {
		if err := registerServiceRoutes(router, service, target, config, logger); err != nil {
			logger.Fatal("failed to register upstream service", zap.String("service", service), zap.Error(err))
		}
	}

	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
	})

	server := &http.Server{
		Addr:              ":" + config.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("starting api gateway", zap.String("port", config.Port))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	sigCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	select {
	case <-sigCtx.Done():
		logger.Info("shutdown signal received")
	case err := <-errCh:
		logger.Fatal("server failed", zap.Error(err))
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), config.ShutdownTimeout)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", zap.Error(err))
	}
}

func loadConfig() Config {
	return Config{
		Port:                    getEnv("PORT", defaultPort),
		RedisAddr:               getEnv("REDIS_ADDR", defaultRedisAddr),
		RedisPassword:           os.Getenv("REDIS_PASSWORD"),
		RedisDB:                 getEnvAsInt("REDIS_DB", 0),
		OTelEndpoint:            getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", defaultOTelEndpoint),
		CORSAllowedOrigins:      splitCSVEnv("CORS_ALLOWED_ORIGINS", "*"),
		JWTIssuer:               os.Getenv("JWT_ISSUER"),
		JWTAudience:             os.Getenv("JWT_AUDIENCE"),
		JWTHMACSecret:           os.Getenv("JWT_HMAC_SECRET"),
		JWTRSAPublicKey:         os.Getenv("JWT_PUBLIC_KEY"),
		RetryMaxAttempts:        getEnvAsInt("RETRY_MAX_ATTEMPTS", 3),
		RetryBaseBackoff:        getEnvAsDuration("RETRY_BASE_BACKOFF", 100*time.Millisecond),
		RetryMaxBackoff:         getEnvAsDuration("RETRY_MAX_BACKOFF", 2*time.Second),
		CircuitFailureThreshold: getEnvAsInt("CIRCUIT_FAILURE_THRESHOLD", 5),
		CircuitHalfOpenSuccess:  getEnvAsInt("CIRCUIT_HALF_OPEN_SUCCESS", 2),
		CircuitOpenTimeout:      getEnvAsDuration("CIRCUIT_OPEN_TIMEOUT", 30*time.Second),
		ProxyTimeout:            getEnvAsDuration("PROXY_TIMEOUT", 15*time.Second),
		ShutdownTimeout:         getEnvAsDuration("SHUTDOWN_TIMEOUT", 15*time.Second),
		Upstreams: map[string]string{
			"users":         getEnv("USER_SERVICE_URL", "http://user-service:8001"),
			"courses":       getEnv("COURSE_SERVICE_URL", "http://course-service:8002"),
			"content":       getEnv("CONTENT_SERVICE_URL", "http://content-service:8003"),
			"quizzes":       getEnv("QUIZ_SERVICE_URL", "http://quiz-service:8004"),
			"notifications": getEnv("NOTIFICATION_SERVICE_URL", "http://notification-service:8005"),
			"search":        getEnv("SEARCH_SERVICE_URL", "http://search-service:8006"),
		},
	}
}

func newLogger() *zap.Logger {
	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.TimeKey = "timestamp"
	encoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	encoderConfig.LevelKey = "level"
	encoderConfig.MessageKey = "message"

	core := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		zapcore.Lock(os.Stdout),
		zap.NewAtomicLevelAt(zap.InfoLevel),
	)

	return zap.New(core, zap.AddCaller(), zap.AddStacktrace(zap.ErrorLevel)).With(zap.String("service", serviceName))
}

func initTracerProvider(ctx context.Context, config Config) (*sdktrace.TracerProvider, error) {
	exporter, err := otlptracegrpc.New(
		ctx,
		otlptracegrpc.WithEndpoint(config.OTelEndpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			attribute.String("service.name", serviceName),
			attribute.String("service.version", "1.0.0"),
		),
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	otel.SetTracerProvider(tp)
	// Register the W3C trace-context + baggage propagator globally so that
	// (a) otelgin extracts the incoming traceparent on inbound requests and
	// (b) otelhttp (below, on the reverse-proxy transport) injects it into
	// outbound requests to upstream services. Without this, the global
	// propagator is a no-op and upstream services start disconnected root
	// traces — leaving them absent from Jaeger's System Architecture graph.
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))
	return tp, nil
}

func initMetrics() {
	metricsOnce.Do(func() {
		requestCounter = prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "api_gateway_http_requests_total",
				Help: "Total number of HTTP requests handled by the API gateway.",
			},
			[]string{"method", "route", "status"},
		)
		requestLatency = prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "api_gateway_http_request_duration_seconds",
				Help:    "HTTP request latency in seconds.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "route", "status"},
		)
		activeRequests = prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "api_gateway_active_connections",
				Help: "Number of in-flight requests.",
			},
		)
		prometheus.MustRegister(requestCounter, requestLatency, activeRequests)
	})
}

// routePrefix maps an inbound gateway path prefix to the base path expected by
// the upstream service. For example an inbound request to "/api/users/me" with
// gatewayPrefix "/api/users" and upstreamBase "/users" is forwarded upstream as
// "/users/me".
type routePrefix struct {
	gatewayPrefix string
	upstreamBase  string
}

func registerServiceRoutes(router *gin.Engine, serviceName, rawURL string, config Config, logger *zap.Logger) error {
	target, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("parse target url: %w", err)
	}

	breaker := NewCircuitBreaker(config.CircuitFailureThreshold, config.CircuitHalfOpenSuccess, config.CircuitOpenTimeout)
	proxy := newReverseProxy(serviceName, target, breaker, logger, config)

	makeHandler := func(upstreamBase string) gin.HandlerFunc {
		return func(c *gin.Context) {
			proxyPath := c.Param("proxyPath")
			outPath := upstreamBase + proxyPath
			if outPath == "" {
				outPath = "/"
			}
			c.Request.URL.Path = outPath
			c.Request.URL.RawPath = outPath
			proxy.ServeHTTP(c.Writer, c.Request)
		}
	}

	for _, prefix := range servicePrefixes(serviceName) {
		handler := makeHandler(prefix.upstreamBase)
		// Exact-prefix match (e.g. "/api/courses") maps to the upstream base.
		router.Any(prefix.gatewayPrefix, makeHandler(prefix.upstreamBase))
		// Wildcard match (e.g. "/api/courses/123") appends the remainder.
		router.Any(prefix.gatewayPrefix+"/*proxyPath", handler)
	}
	return nil
}

func servicePrefixes(service string) []routePrefix {
	switch service {
	case "users":
		return []routePrefix{
			{gatewayPrefix: "/users", upstreamBase: "/users"},
			{gatewayPrefix: "/api/users", upstreamBase: "/users"},
			{gatewayPrefix: "/api/v1/users", upstreamBase: "/users"},
			// Authentication endpoints live under /auth on the user-service.
			{gatewayPrefix: "/auth", upstreamBase: "/auth"},
			{gatewayPrefix: "/api/auth", upstreamBase: "/auth"},
			{gatewayPrefix: "/api/v1/auth", upstreamBase: "/auth"},
		}
	case "courses":
		return []routePrefix{
			{gatewayPrefix: "/courses", upstreamBase: "/courses"},
			{gatewayPrefix: "/api/courses", upstreamBase: "/courses"},
			{gatewayPrefix: "/api/v1/courses", upstreamBase: "/courses"},
		}
	case "content":
		return []routePrefix{
			{gatewayPrefix: "/content", upstreamBase: "/content"},
			{gatewayPrefix: "/api/content", upstreamBase: "/content"},
			{gatewayPrefix: "/api/v1/content", upstreamBase: "/content"},
			// Lessons live in the content-service under /lessons. Expose them
			// via /api/lessons so the frontend can reach them through the gateway.
			{gatewayPrefix: "/lessons", upstreamBase: "/lessons"},
			{gatewayPrefix: "/api/lessons", upstreamBase: "/lessons"},
			{gatewayPrefix: "/api/v1/lessons", upstreamBase: "/lessons"},
		}
	case "quizzes":
		return []routePrefix{
			{gatewayPrefix: "/quizzes", upstreamBase: "/quizzes"},
			{gatewayPrefix: "/quiz", upstreamBase: "/quizzes"},
			{gatewayPrefix: "/api/quizzes", upstreamBase: "/quizzes"},
			{gatewayPrefix: "/api/v1/quizzes", upstreamBase: "/quizzes"},
		}
	case "notifications":
		return []routePrefix{
			{gatewayPrefix: "/notifications", upstreamBase: "/notifications"},
			{gatewayPrefix: "/api/notifications", upstreamBase: "/notifications"},
			{gatewayPrefix: "/api/v1/notifications", upstreamBase: "/notifications"},
		}
	case "search":
		return []routePrefix{
			{gatewayPrefix: "/search", upstreamBase: "/search"},
			{gatewayPrefix: "/api/search", upstreamBase: "/search"},
			{gatewayPrefix: "/api/v1/search", upstreamBase: "/search"},
		}
	default:
		return []routePrefix{
			{gatewayPrefix: "/" + service, upstreamBase: "/" + service},
			{gatewayPrefix: "/api/" + service, upstreamBase: "/" + service},
			{gatewayPrefix: "/api/v1/" + service, upstreamBase: "/" + service},
		}
	}
}

func newReverseProxy(service string, target *url.URL, breaker *CircuitBreaker, logger *zap.Logger, config Config) *httputil.ReverseProxy {
	transport := &ResilientTransport{
		base: otelhttp.NewTransport(&http.Transport{
			// Do NOT use HTTP_PROXY/HTTPS_PROXY for internal service-to-service
			// calls. Upstreams are reached via internal Docker/K8s hostnames
			// (e.g. http://user-service:8001) which a corporate/egress proxy
			// cannot resolve, producing spurious 502s. Force a direct dial.
			Proxy:                 nil,
			MaxIdleConns:          100,
			MaxIdleConnsPerHost:   20,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   5 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
			ResponseHeaderTimeout: config.ProxyTimeout,
		}),
		breaker:     breaker,
		logger:      logger,
		service:     service,
		maxAttempts: config.RetryMaxAttempts,
		baseBackoff: config.RetryBaseBackoff,
		maxBackoff:  config.RetryMaxBackoff,
	}

	return &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetXForwarded()
			pr.SetURL(target)
			pr.Out.Host = target.Host
			pr.Out.Header.Set("X-Gateway-Service", serviceName)
		},
		Transport: transport,
		ErrorHandler: func(rw http.ResponseWriter, req *http.Request, err error) {
			fields := proxyLogFields(req.Context(), logger, zap.String("upstream_service", service), zap.String("target", target.String()), zap.Error(err))
			logger.Error("proxy request failed", fields...)

			status := http.StatusBadGateway
			message := "upstream request failed"
			if errors.Is(err, errCircuitOpen) {
				status = http.StatusServiceUnavailable
				message = "upstream temporarily unavailable"
			}
			rw.Header().Set("Content-Type", "application/json")
			rw.WriteHeader(status)
			_, _ = rw.Write([]byte(fmt.Sprintf(`{"error":"%s"}`, message)))
		},
	}
}

func newJWTValidator(config Config) (*JWTValidator, error) {
	validator := &JWTValidator{
		issuer:   config.JWTIssuer,
		audience: config.JWTAudience,
	}

	if config.JWTHMACSecret != "" {
		validator.hmacSecret = []byte(config.JWTHMACSecret)
	}
	if config.JWTRSAPublicKey != "" {
		rsaKey, err := parseRSAPublicKey(config.JWTRSAPublicKey)
		if err != nil {
			return nil, err
		}
		validator.rsaKey = rsaKey
	}
	return validator, nil
}

func parseRSAPublicKey(raw string) (*rsa.PublicKey, error) {
	parsed := raw
	if !strings.Contains(raw, "BEGIN") {
		decoded, err := base64.StdEncoding.DecodeString(raw)
		if err != nil {
			return nil, fmt.Errorf("decode rsa public key: %w", err)
		}
		parsed = string(decoded)
	}

	block, _ := pem.Decode([]byte(parsed))
	if block == nil {
		return nil, errors.New("invalid rsa public key pem")
	}

	if pub, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		rsaKey, ok := pub.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("rsa public key is not RSA")
		}
		return rsaKey, nil
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse rsa public key: %w", err)
	}
	rsaKey, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("certificate public key is not RSA")
	}
	return rsaKey, nil
}

// GatewayClaims extends the standard registered claims with the identity
// fields the user-service embeds in its tokens (email, role), so the gateway
// can forward a trusted identity to upstream services.
type GatewayClaims struct {
	jwt.RegisteredClaims
	Email string `json:"email,omitempty"`
	Role  string `json:"role,omitempty"`
}

func (v *JWTValidator) Validate(tokenString string) (*GatewayClaims, error) {
	parser := jwt.NewParser(jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg(), jwt.SigningMethodRS256.Alg()}))
	claims := &GatewayClaims{}

	token, err := parser.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		switch token.Method.Alg() {
		case jwt.SigningMethodHS256.Alg():
			if len(v.hmacSecret) == 0 {
				return nil, errors.New("hs256 tokens are not configured")
			}
			return v.hmacSecret, nil
		case jwt.SigningMethodRS256.Alg():
			if v.rsaKey == nil {
				return nil, errors.New("rs256 tokens are not configured")
			}
			return v.rsaKey, nil
		default:
			return nil, fmt.Errorf("unsupported signing method: %s", token.Method.Alg())
		}
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("token is invalid")
	}
	if v.issuer != "" && claims.Issuer != v.issuer {
		return nil, errors.New("token issuer mismatch")
	}
	if v.audience != "" && !containsAudience(claims.Audience, v.audience) {
		return nil, errors.New("token audience mismatch")
	}
	return claims, nil
}

func containsAudience(audiences []string, expected string) bool {
	for _, audience := range audiences {
		if audience == expected {
			return true
		}
	}
	return false
}

func NewRedisRateLimiter(client *redis.Client, capacity int, window time.Duration) *RedisRateLimiter {
	return &RedisRateLimiter{
		client: client,
		script: redis.NewScript(`
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_per_ms = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local data = redis.call('HMGET', key, 'tokens', 'last')
local tokens = tonumber(data[1])
local last = tonumber(data[2])
if tokens == nil then tokens = capacity end
if last == nil then last = now end
local delta = math.max(0, now - last)
local refill = delta * refill_per_ms
if refill > 0 then
  tokens = math.min(capacity, tokens + refill)
end
local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end
redis.call('HMSET', key, 'tokens', tokens, 'last', now)
redis.call('PEXPIRE', key, ttl)
return { allowed, tokens }
`),
		capacity:    float64(capacity),
		refillPerMs: float64(capacity) / float64(window.Milliseconds()),
		keyTTL:      2 * window,
		window:      window,
	}
}

func (r *RedisRateLimiter) Allow(ctx context.Context, key string) (bool, int, error) {
	now := time.Now().UnixMilli()
	result, err := r.script.Run(ctx, r.client, []string{key}, now, r.capacity, r.refillPerMs, r.keyTTL.Milliseconds()).Result()
	if err != nil {
		return false, 0, err
	}

	values, ok := result.([]interface{})
	if !ok || len(values) != 2 {
		return false, 0, errors.New("unexpected redis rate limiter response")
	}

	allowed, err := toInt(values[0])
	if err != nil {
		return false, 0, err
	}
	remainingFloat, err := toFloat(values[1])
	if err != nil {
		return false, 0, err
	}
	remaining := int(math.Max(0, math.Floor(remainingFloat)))
	return allowed == 1, remaining, nil
}

func NewCircuitBreaker(failureThreshold, successThreshold int, openTimeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		state:            circuitClosed,
		failureThreshold: failureThreshold,
		successThreshold: successThreshold,
		openTimeout:      openTimeout,
	}
}

func (cb *CircuitBreaker) Allow() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.state != circuitOpen {
		return nil
	}
	if time.Since(cb.openedAt) >= cb.openTimeout {
		cb.state = circuitHalfOpen
		cb.halfOpenSuccesses = 0
		return nil
	}
	return errCircuitOpen
}

func (cb *CircuitBreaker) OnSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case circuitHalfOpen:
		cb.halfOpenSuccesses++
		if cb.halfOpenSuccesses >= cb.successThreshold {
			cb.state = circuitClosed
			cb.failures = 0
			cb.halfOpenSuccesses = 0
		}
	case circuitClosed:
		cb.failures = 0
	}
}

func (cb *CircuitBreaker) OnFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case circuitHalfOpen:
		cb.state = circuitOpen
		cb.halfOpenSuccesses = 0
		cb.openedAt = time.Now()
	case circuitClosed:
		cb.failures++
		if cb.failures >= cb.failureThreshold {
			cb.state = circuitOpen
			cb.openedAt = time.Now()
		}
	}
}

func (t *ResilientTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if err := t.breaker.Allow(); err != nil {
		return nil, err
	}

	attempts := t.maxAttempts
	if attempts < 1 {
		attempts = 1
	}
	if !isRetryableMethod(req.Method) && req.GetBody == nil {
		attempts = 1
	}

	var resp *http.Response
	var err error

	for attempt := 1; attempt <= attempts; attempt++ {
		currentReq, cloneErr := cloneRequest(req, attempt)
		if cloneErr != nil {
			return nil, cloneErr
		}

		resp, err = t.base.RoundTrip(currentReq)
		if err == nil && !shouldRetryStatus(resp.StatusCode) {
			t.breaker.OnSuccess()
			return resp, nil
		}

		if err == nil && resp != nil && shouldRetryStatus(resp.StatusCode) {
			_ = resp.Body.Close()
		}

		if attempt == attempts {
			t.breaker.OnFailure()
			if err != nil {
				return nil, err
			}
			return resp, nil
		}

		backoff := exponentialBackoff(attempt, t.baseBackoff, t.maxBackoff)
		t.logger.Warn("retrying upstream request",
			zap.String("upstream_service", t.service),
			zap.Int("attempt", attempt+1),
			zap.Duration("backoff", backoff),
		)

		timer := time.NewTimer(backoff)
		select {
		case <-req.Context().Done():
			timer.Stop()
			return nil, req.Context().Err()
		case <-timer.C:
		}
	}

	t.breaker.OnFailure()
	return resp, err
}

func cloneRequest(req *http.Request, attempt int) (*http.Request, error) {
	if attempt == 1 {
		return req, nil
	}

	cloned := req.Clone(req.Context())
	if req.GetBody == nil {
		if req.Body == nil || req.Body == http.NoBody || req.ContentLength == 0 {
			cloned.Body = nil
			return cloned, nil
		}
		return nil, errors.New("request body cannot be replayed for retry")
	}
	body, err := req.GetBody()
	if err != nil {
		return nil, err
	}
	cloned.Body = body
	return cloned, nil
}

func exponentialBackoff(attempt int, base, max time.Duration) time.Duration {
	multiplier := math.Pow(2, float64(attempt-1))
	backoff := time.Duration(float64(base) * multiplier)
	if backoff > max {
		return max
	}
	return backoff
}

func shouldRetryStatus(status int) bool {
	switch status {
	case http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return true
	default:
		return false
	}
}

func isRetryableMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions, http.MethodDelete:
		return true
	default:
		return false
	}
}

func recoveryMiddleware(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("panic recovered", append(proxyLogFields(c.Request.Context(), logger), zap.Any("panic", recovered))...)
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
			}
		}()
		c.Next()
	}
}

func metricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		activeRequests.Inc()
		defer activeRequests.Dec()

		started := time.Now()
		c.Next()

		route := c.FullPath()
		if route == "" {
			route = "unmatched"
		}
		status := strconv.Itoa(c.Writer.Status())
		requestCounter.WithLabelValues(c.Request.Method, route, status).Inc()
		requestLatency.WithLabelValues(c.Request.Method, route, status).Observe(time.Since(started).Seconds())
	}
}

func loggingMiddleware(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		started := time.Now()
		c.Next()

		route := c.FullPath()
		if route == "" {
			route = c.Request.URL.Path
		}

		fields := append(proxyLogFields(c.Request.Context(), logger),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.String("route", route),
			zap.String("client_ip", c.ClientIP()),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", time.Since(started)),
			zap.Int("bytes_written", c.Writer.Size()),
		)

		if len(c.Errors) > 0 {
			fields = append(fields, zap.String("errors", c.Errors.String()))
			logger.Error("request completed with errors", fields...)
			return
		}
		logger.Info("request completed", fields...)
	}
}

func proxyLogFields(ctx context.Context, _ *zap.Logger, fields ...zap.Field) []zap.Field {
	spanCtx := trace.SpanContextFromContext(ctx)
	traceID := ""
	spanID := ""
	if spanCtx.IsValid() {
		traceID = spanCtx.TraceID().String()
		spanID = spanCtx.SpanID().String()
	}
	return append([]zap.Field{
		zap.String("trace_id", traceID),
		zap.String("span_id", spanID),
	}, fields...)
}

func authMiddleware(validator *JWTValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Strip any client-supplied identity headers so they cannot be spoofed;
		// only the gateway is trusted to set these after validating the JWT.
		c.Request.Header.Del("X-User-Id")
		c.Request.Header.Del("X-User-Role")
		c.Request.Header.Del("X-User-Email")

		if shouldSkipSecurity(c.Request.URL.Path) {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}

		claims, err := validator.Validate(strings.TrimSpace(authHeader[7:]))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		// Forward the validated identity to upstream services as trusted headers.
		c.Request.Header.Set("X-User-Id", claims.Subject)
		if claims.Role != "" {
			c.Request.Header.Set("X-User-Role", claims.Role)
		}
		if claims.Email != "" {
			c.Request.Header.Set("X-User-Email", claims.Email)
		}

		c.Set("user_id", claims.Subject)
		c.Set("jwt_claims", claims)
		c.Next()
	}
}

func rateLimitMiddleware(limiter *RedisRateLimiter, logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		if shouldSkipSecurity(c.Request.URL.Path) {
			c.Next()
			return
		}

		userID := c.GetString("user_id")
		if userID == "" {
			userID = "anonymous:" + c.ClientIP()
		}
		key := fmt.Sprintf("rate_limit:%s", userID)

		allowed, remaining, err := limiter.Allow(c.Request.Context(), key)
		if err != nil {
			logger.Error("redis rate limiter failed", append(proxyLogFields(c.Request.Context(), logger), zap.Error(err))...)
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "rate limiter unavailable"})
			return
		}

		c.Header("X-RateLimit-Limit", strconv.Itoa(requestsPerMinute))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		if !allowed {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}
		c.Next()
	}
}

func retryBufferMiddleware(limit int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body == nil || c.Request.GetBody != nil || c.Request.ContentLength <= 0 || c.Request.ContentLength > limit {
			c.Next()
			return
		}

		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
			return
		}

		c.Request.Body = io.NopCloser(bytes.NewReader(bodyBytes))
		c.Request.GetBody = func() (io.ReadCloser, error) {
			return io.NopCloser(bytes.NewReader(bodyBytes)), nil
		}
		c.Request.ContentLength = int64(len(bodyBytes))
		c.Next()
	}
}

func corsMiddleware(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	wildcard := false
	for _, origin := range allowedOrigins {
		trimmed := strings.TrimSpace(origin)
		if trimmed == "*" {
			wildcard = true
		}
		if trimmed != "" {
			allowed[trimmed] = struct{}{}
		}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if wildcard {
			c.Header("Access-Control-Allow-Origin", "*")
		} else if origin != "" {
			if _, ok := allowed[origin]; ok {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Vary", "Origin")
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, Traceparent, Tracestate, X-Requested-With")
		c.Header("Access-Control-Expose-Headers", "X-RateLimit-Limit, X-RateLimit-Remaining")
		if !wildcard {
			c.Header("Access-Control-Allow-Credentials", "true")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func shouldSkipSecurity(path string) bool {
	if path == "/health" || path == "/ready" || path == "/metrics" {
		return true
	}
	return isPublicAuthPath(path) || isPublicQuizPreviewPath(path) || isPublicSearchPath(path)
}

// isPublicAuthPath reports whether the request targets an authentication
// endpoint that must be reachable without an existing bearer token (i.e. the
// endpoints a client uses to obtain a token in the first place).
func isPublicAuthPath(path string) bool {
	trimmed := strings.TrimRight(path, "/")
	switch trimmed {
	case "/auth/register", "/auth/login", "/auth/refresh",
		"/api/auth/register", "/api/auth/login", "/api/auth/refresh",
		"/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/refresh":
		return true
	default:
		return false
	}
}

// isPublicQuizPreviewPath reports whether the request targets the
// unauthenticated quiz preview endpoint used by the public/marketing
// landing page to show a couple of sample quizzes before sign-up. The
// downstream quiz-service itself limits this endpoint to a handful of
// published quizzes with correct answers redacted, so it's safe to expose
// without a bearer token.
func isPublicQuizPreviewPath(path string) bool {
	trimmed := strings.TrimRight(path, "/")
	switch trimmed {
	case "/quizzes/public", "/api/quizzes/public", "/api/v1/quizzes/public":
		return true
	default:
		return false
	}
}

// isPublicSearchPath reports whether the request targets the course search
// endpoint served by the standalone search-service. Course search only
// exposes published catalog metadata (title, description, tags, price), so
// it is safe to serve to anonymous visitors browsing the marketing site,
// mirroring the public quiz preview.
func isPublicSearchPath(path string) bool {
	trimmed := strings.TrimRight(path, "/")
	if trimmed == "/search" || trimmed == "/api/search" || trimmed == "/api/v1/search" {
		return true
	}
	return strings.HasPrefix(trimmed, "/search/") ||
		strings.HasPrefix(trimmed, "/api/search/") ||
		strings.HasPrefix(trimmed, "/api/v1/search/")
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func splitCSVEnv(key, fallback string) []string {
	value := getEnv(key, fallback)
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func getEnvAsInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvAsDuration(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func toInt(value interface{}) (int, error) {
	switch v := value.(type) {
	case int64:
		return int(v), nil
	case string:
		parsed, err := strconv.Atoi(v)
		if err != nil {
			return 0, err
		}
		return parsed, nil
	default:
		return 0, fmt.Errorf("unexpected int value type %T", value)
	}
}

func toFloat(value interface{}) (float64, error) {
	switch v := value.(type) {
	case float64:
		return v, nil
	case int64:
		return float64(v), nil
	case string:
		parsed, err := strconv.ParseFloat(v, 64)
		if err != nil {
			return 0, err
		}
		return parsed, nil
	default:
		return 0, fmt.Errorf("unexpected float value type %T", value)
	}
}
