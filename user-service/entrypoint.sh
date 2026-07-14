#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting user-service..."
exec uvicorn main:app --host 0.0.0.0 --port 8001
