#!/bin/sh
set -e

echo "Starting certification-service..."
exec uvicorn main:app --host 0.0.0.0 --port 8009
