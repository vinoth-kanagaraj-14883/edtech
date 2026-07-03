BINARY=bin/api-gateway

.PHONY: build run test docker-build clean

build:
	mkdir -p bin
	go build -o $(BINARY) .

run:
	go run .

test:
	go test ./...

docker-build:
	docker build -t api-gateway:latest .

clean:
	rm -rf bin
