FROM golang:1.25-alpine AS builder

WORKDIR /src

COPY go.mod go.sum* ./
COPY vendor ./vendor
COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod=vendor -ldflags='-s -w' -o /app/notification-service .

FROM scratch AS runtime

WORKDIR /app

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /app/notification-service /app/notification-service

ENV PORT=8005

EXPOSE 8005

USER 65532:65532

ENTRYPOINT ["/app/notification-service"]
