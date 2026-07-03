FROM golang:1.25-alpine AS builder

RUN apk add --no-cache ca-certificates git tzdata

WORKDIR /src

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags='-s -w' -o /app/notification-service .

FROM alpine:3.19 AS runtime

RUN apk add --no-cache ca-certificates tzdata     && addgroup -S app     && adduser -S -G app app

WORKDIR /app

COPY --from=builder /app/notification-service /app/notification-service

ENV PORT=8005

EXPOSE 8005

USER app

ENTRYPOINT ["/app/notification-service"]
