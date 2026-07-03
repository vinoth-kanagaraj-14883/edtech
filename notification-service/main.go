package main

import (
	"context"
	crand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"github.com/valyala/fasthttp"
	"github.com/valyala/fasthttp/fasthttpadaptor"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	sdkresource "go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

const (
	serviceName     = "notification-service"
	metricNamespace = "notification_service"
)

type notification struct {
	ID        string                 `json:"id"`
	UserID    string                 `json:"user_id"`
	Type      string                 `json:"type"`
	Title     string                 `json:"title"`
	Message   string                 `json:"message"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Read      bool                   `json:"read"`
	CreatedAt time.Time              `json:"created_at"`
	ReadAt    *time.Time             `json:"read_at,omitempty"`
}

type appMetrics struct {
	requestCounter    *prometheus.CounterVec
	requestDuration   *prometheus.HistogramVec
	notificationsSent prometheus.Counter
	registry          *prometheus.Registry
}

type service struct {
	app            *fiber.App
	redis          *redis.Client
	logger         *zap.Logger
	tracerProvider *sdktrace.TracerProvider
	tracer         trace.Tracer
	metrics        *appMetrics
	metricsHandler fasthttp.RequestHandler
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	logger, err := zap.NewProduction()
	if err != nil {
		panic(err)
	}
	defer logger.Sync()

	tracerProvider, err := newTracerProvider(ctx)
	if err != nil {
		logger.Fatal("failed to initialize tracing", zap.Error(err))
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = tracerProvider.Shutdown(shutdownCtx)
	}()

	metrics := newMetrics()

	redisClient := redis.NewClient(&redis.Options{
		Addr:         envOrDefault("REDIS_ADDR", "redis:6379"),
		Password:     os.Getenv("REDIS_PASSWORD"),
		DB:           envInt("REDIS_DB", 0),
		DialTimeout:  5 * time.Second,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		PoolSize:     envInt("REDIS_POOL_SIZE", 10),
	})

	if err := redisClient.Ping(ctx).Err(); err != nil {
		logger.Fatal("failed to connect to redis", zap.Error(err))
	}

	otel.SetTracerProvider(tracerProvider)
	otel.SetTextMapPropagator(propagation.TraceContext{})

	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			var fiberErr *fiber.Error
			if errors.As(err, &fiberErr) {
				code = fiberErr.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error":   httpStatusText(code),
				"message": err.Error(),
			})
		},
	})

	svc := &service{
		app:            app,
		redis:          redisClient,
		logger:         logger,
		tracerProvider: tracerProvider,
		tracer:         otel.Tracer(serviceName),
		metrics:        metrics,
		metricsHandler: fasthttpadaptor.NewFastHTTPHandler(promhttp.HandlerFor(metrics.registry, promhttp.HandlerOpts{})),
	}

	app.Use(svc.tracingMiddleware())
	app.Use(svc.metricsMiddleware())
	svc.registerRoutes()

	subscriberCtx, cancelSubscriber := context.WithCancel(context.Background())
	defer cancelSubscriber()

	pubsubDone := make(chan error, 1)
	go func() {
		pubsubDone <- svc.consumeNotifications(subscriberCtx)
	}()

	serverErrCh := make(chan error, 1)
	go func() {
		address := fmt.Sprintf(":%d", envInt("PORT", 8005))
		logger.Info("starting notification service", zap.String("address", address))
		serverErrCh <- app.Listen(address)
	}()

	select {
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	case err := <-serverErrCh:
		if err != nil {
			logger.Fatal("fiber server exited", zap.Error(err))
		}
	}

	cancelSubscriber()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := app.Shutdown(); err != nil {
		logger.Error("failed to shutdown fiber app", zap.Error(err))
	}

	select {
	case err := <-pubsubDone:
		if err != nil && !errors.Is(err, context.Canceled) {
			logger.Error("notification subscriber stopped", zap.Error(err))
		}
	case <-shutdownCtx.Done():
		logger.Warn("subscriber shutdown timed out")
	}

	if err := redisClient.Close(); err != nil {
		logger.Error("failed to close redis client", zap.Error(err))
	}
}

func newTracerProvider(ctx context.Context) (*sdktrace.TracerProvider, error) {
	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(envOrDefault("OTEL_EXPORTER_OTLP_ENDPOINT", "otel-collector:4317")),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	resource, err := sdkresource.New(ctx,
		sdkresource.WithAttributes(
			semconv.ServiceName(serviceName),
		),
	)
	if err != nil {
		return nil, err
	}

	return sdktrace.NewTracerProvider(
		sdktrace.WithResource(resource),
		sdktrace.WithBatcher(exporter),
	), nil
}

func newMetrics() *appMetrics {
	registry := prometheus.NewRegistry()
	registry.MustRegister(collectors.NewGoCollector(), collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))

	requestCounter := prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricNamespace,
		Name:      "http_requests_total",
		Help:      "Total number of HTTP requests handled by the notification service.",
	}, []string{"method", "route", "status"})

	requestDuration := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricNamespace,
		Name:      "http_request_duration_seconds",
		Help:      "Latency of HTTP requests handled by the notification service.",
		Buckets:   []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
	}, []string{"method", "route", "status"})

	notificationsSent := prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: metricNamespace,
		Name:      "notifications_sent_total",
		Help:      "Total number of notifications created from pub/sub events.",
	})

	registry.MustRegister(requestCounter, requestDuration, notificationsSent)

	return &appMetrics{
		requestCounter:    requestCounter,
		requestDuration:   requestDuration,
		notificationsSent: notificationsSent,
		registry:          registry,
	}
}

func (s *service) registerRoutes() {
	s.app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "ok",
			"service":   serviceName,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	s.app.Get("/ready", func(c *fiber.Ctx) error {
		if err := s.redis.Ping(c.UserContext()).Err(); err != nil {
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"status":  "not_ready",
				"service": serviceName,
				"error":   err.Error(),
			})
		}
		return c.JSON(fiber.Map{"status": "ready", "service": serviceName})
	})

	s.app.Get("/metrics", func(c *fiber.Ctx) error {
		c.Set(fiber.HeaderContentType, "text/plain; version=0.0.4")
		s.metricsHandler(c.Context())
		return nil
	})

	s.app.Get("/notifications/:userId", s.getNotifications)
	s.app.Put("/notifications/:id/read", s.markNotificationRead)
	s.app.Put("/notifications/:userId/read-all", s.markAllRead)
}

func (s *service) tracingMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		ctx, span := s.tracer.Start(
			c.UserContext(),
			fmt.Sprintf("%s %s", c.Method(), c.Path()),
			trace.WithSpanKind(trace.SpanKindServer),
		)
		c.SetUserContext(ctx)
		defer span.End()

		err := c.Next()
		route := routePattern(c)
		statusCode := c.Response().StatusCode()
		span.SetAttributes(
			attribute.String("http.method", c.Method()),
			attribute.String("http.route", route),
			attribute.Int("http.status_code", statusCode),
		)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			return err
		}
		span.SetStatus(codes.Ok, "")
		return nil
	}
}

func (s *service) metricsMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		duration := time.Since(start)
		route := routePattern(c)
		statusCode := strconv.Itoa(c.Response().StatusCode())

		s.metrics.requestCounter.WithLabelValues(c.Method(), route, statusCode).Inc()
		s.metrics.requestDuration.WithLabelValues(c.Method(), route, statusCode).Observe(duration.Seconds())

		span := trace.SpanFromContext(c.UserContext())
		spanContext := span.SpanContext()
		s.logger.Info("request completed",
			zap.String("timestamp", time.Now().UTC().Format(time.RFC3339Nano)),
			zap.String("service", serviceName),
			zap.String("trace_id", spanContext.TraceID().String()),
			zap.String("span_id", spanContext.SpanID().String()),
			zap.String("method", c.Method()),
			zap.String("path", c.Path()),
			zap.String("route", route),
			zap.Int("status", c.Response().StatusCode()),
			zap.Float64("duration_ms", float64(duration.Microseconds())/1000.0),
		)

		return err
	}
}

func (s *service) consumeNotifications(ctx context.Context) error {
	channels := []string{"user.registered", "course.enrolled", "quiz.completed", "course.completed"}
	pubsub := s.redis.Subscribe(ctx, channels...)
	defer pubsub.Close()

	if _, err := pubsub.Receive(ctx); err != nil {
		return err
	}

	s.logger.Info("subscribed to redis channels", zap.Strings("channels", channels))

	for {
		msg, err := pubsub.ReceiveMessage(ctx)
		if err != nil {
			if errors.Is(err, context.Canceled) || ctx.Err() != nil {
				return ctx.Err()
			}
			return err
		}

		if err := s.processMessage(ctx, msg); err != nil {
			s.logger.Error("failed to process pubsub message", zap.Error(err), zap.String("channel", msg.Channel))
		}
	}
}

func (s *service) processMessage(ctx context.Context, msg *redis.Message) error {
	spanCtx, span := s.tracer.Start(ctx, "redis pubsub process", trace.WithSpanKind(trace.SpanKindConsumer))
	defer span.End()

	span.SetAttributes(
		attribute.String("messaging.system", "redis"),
		attribute.String("messaging.destination", msg.Channel),
	)

	payload := map[string]interface{}{}
	if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	userID := extractString(payload, "user_id", "userId")
	if userID == "" {
		err := errors.New("message payload missing user_id")
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	item := notificationFromEvent(msg.Channel, userID, payload)
	if err := s.storeNotification(spanCtx, item); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	s.metrics.notificationsSent.Inc()
	span.SetAttributes(
		attribute.String("notification.id", item.ID),
		attribute.String("user.id", item.UserID),
	)
	span.SetStatus(codes.Ok, "")
	s.logger.Info("notification created",
		zap.String("timestamp", time.Now().UTC().Format(time.RFC3339Nano)),
		zap.String("service", serviceName),
		zap.String("trace_id", span.SpanContext().TraceID().String()),
		zap.String("span_id", span.SpanContext().SpanID().String()),
		zap.String("notification_id", item.ID),
		zap.String("user_id", item.UserID),
		zap.String("type", item.Type),
	)
	return nil
}

func notificationFromEvent(channel, userID string, payload map[string]interface{}) notification {
	createdAt := time.Now().UTC()
	courseID := extractString(payload, "course_id", "courseId")
	quizID := extractString(payload, "quiz_id", "quizId")

	title := extractString(payload, "title")
	message := extractString(payload, "message")

	switch channel {
	case "user.registered":
		if title == "" {
			title = "Welcome to EdTech"
		}
		if message == "" {
			message = "Your account is ready. Explore courses and take your first quiz."
		}
	case "course.enrolled":
		if title == "" {
			title = "Enrollment confirmed"
		}
		if message == "" {
			if courseID != "" {
				message = fmt.Sprintf("You have been enrolled in course %s.", courseID)
			} else {
				message = "You have successfully enrolled in a new course."
			}
		}
	case "quiz.completed":
		scoreValue := extractFloat(payload, "score")
		if title == "" {
			title = "Quiz completed"
		}
		if message == "" {
			if quizID != "" {
				message = fmt.Sprintf("Quiz %s completed with a score of %.2f%%.", quizID, scoreValue)
			} else {
				message = fmt.Sprintf("A quiz was completed with a score of %.2f%%.", scoreValue)
			}
		}
	case "course.completed":
		if title == "" {
			title = "Course completed"
		}
		if message == "" {
			if courseID != "" {
				message = fmt.Sprintf("Congratulations on completing course %s.", courseID)
			} else {
				message = "Congratulations on completing your course."
			}
		}
	}

	return notification{
		ID:        newNotificationID(),
		UserID:    userID,
		Type:      channel,
		Title:     title,
		Message:   message,
		Metadata:  payload,
		Read:      false,
		CreatedAt: createdAt,
	}
}

func (s *service) storeNotification(ctx context.Context, item notification) error {
	payload, err := json.Marshal(item)
	if err != nil {
		return err
	}

	_, err = s.redis.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
		pipe.Set(ctx, notificationRedisKey(item.ID), payload, 0)
		pipe.ZAdd(ctx, userNotificationsRedisKey(item.UserID), redis.Z{
			Score:  float64(item.CreatedAt.UnixMilli()),
			Member: item.ID,
		})
		return nil
	})
	return err
}

func (s *service) getNotifications(c *fiber.Ctx) error {
	page := positiveInt(c.Query("page"), 1)
	perPage := positiveInt(c.Query("per_page"), 20)
	if perPage > 100 {
		perPage = 100
	}

	userID := c.Params("userId")
	key := userNotificationsRedisKey(userID)
	total, err := s.redis.ZCard(c.UserContext(), key).Result()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	start := int64((page - 1) * perPage)
	end := start + int64(perPage) - 1
	ids, err := s.redis.ZRevRange(c.UserContext(), key, start, end).Result()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	items, err := s.fetchNotifications(c.UserContext(), ids)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	totalPages := 0
	if total > 0 {
		totalPages = int((total + int64(perPage) - 1) / int64(perPage))
	}

	return c.JSON(fiber.Map{
		"notifications": items,
		"pagination": fiber.Map{
			"page":        page,
			"per_page":    perPage,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}

func (s *service) fetchNotifications(ctx context.Context, ids []string) ([]notification, error) {
	if len(ids) == 0 {
		return []notification{}, nil
	}

	cmders, err := s.redis.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		for _, id := range ids {
			pipe.Get(ctx, notificationRedisKey(id))
		}
		return nil
	})
	if err != nil && !errors.Is(err, redis.Nil) {
		return nil, err
	}

	items := make([]notification, 0, len(ids))
	for _, cmd := range cmders {
		stringCmd, ok := cmd.(*redis.StringCmd)
		if !ok {
			continue
		}
		raw, err := stringCmd.Result()
		if err != nil {
			if errors.Is(err, redis.Nil) {
				continue
			}
			return nil, err
		}

		var item notification
		if err := json.Unmarshal([]byte(raw), &item); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, nil
}

func (s *service) markNotificationRead(c *fiber.Ctx) error {
	item, err := s.loadNotification(c.UserContext(), c.Params("id"))
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return fiber.NewError(fiber.StatusNotFound, "notification not found")
		}
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	if !item.Read {
		now := time.Now().UTC()
		item.Read = true
		item.ReadAt = &now
		if err := s.persistNotification(c.UserContext(), item); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
	}

	return c.JSON(fiber.Map{"notification": item})
}

func (s *service) markAllRead(c *fiber.Ctx) error {
	userID := c.Params("userId")
	ids, err := s.redis.ZRevRange(c.UserContext(), userNotificationsRedisKey(userID), 0, -1).Result()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	items, err := s.fetchNotifications(c.UserContext(), ids)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, err.Error())
	}

	now := time.Now().UTC()
	updated := 0
	for _, item := range items {
		if item.Read {
			continue
		}
		item.Read = true
		item.ReadAt = &now
		if err := s.persistNotification(c.UserContext(), item); err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
		updated++
	}

	return c.JSON(fiber.Map{"updated": updated})
}

func (s *service) loadNotification(ctx context.Context, id string) (notification, error) {
	raw, err := s.redis.Get(ctx, notificationRedisKey(id)).Result()
	if err != nil {
		return notification{}, err
	}

	var item notification
	if err := json.Unmarshal([]byte(raw), &item); err != nil {
		return notification{}, err
	}
	return item, nil
}

func (s *service) persistNotification(ctx context.Context, item notification) error {
	payload, err := json.Marshal(item)
	if err != nil {
		return err
	}
	return s.redis.Set(ctx, notificationRedisKey(item.ID), payload, 0).Err()
}

func newNotificationID() string {
	buffer := make([]byte, 12)
	if _, err := crand.Read(buffer); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buffer)
}

func notificationRedisKey(id string) string {
	return fmt.Sprintf("notification:%s", id)
}

func userNotificationsRedisKey(userID string) string {
	return fmt.Sprintf("notifications:user:%s", userID)
}

func positiveInt(raw string, fallback int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(os.Getenv(key)))
	if err != nil {
		return fallback
	}
	return value
}

func extractString(payload map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := payload[key]; ok && value != nil {
			switch typed := value.(type) {
			case string:
				if strings.TrimSpace(typed) != "" {
					return typed
				}
			default:
				rendered := fmt.Sprintf("%v", typed)
				if strings.TrimSpace(rendered) != "" {
					return rendered
				}
			}
		}
	}
	return ""
}

func extractFloat(payload map[string]interface{}, key string) float64 {
	value, ok := payload[key]
	if !ok || value == nil {
		return 0
	}
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	case json.Number:
		parsed, _ := typed.Float64()
		return parsed
	case string:
		parsed, _ := strconv.ParseFloat(typed, 64)
		return parsed
	default:
		return 0
	}
}

func routePattern(c *fiber.Ctx) string {
	if c.Route() != nil && c.Route().Path != "" {
		return c.Route().Path
	}
	return c.Path()
}

func httpStatusText(code int) string {
	switch code {
	case fiber.StatusBadRequest:
		return "bad_request"
	case fiber.StatusNotFound:
		return "not_found"
	case fiber.StatusServiceUnavailable:
		return "service_unavailable"
	default:
		if code >= 500 {
			return "internal_server_error"
		}
		return "request_failed"
	}
}
