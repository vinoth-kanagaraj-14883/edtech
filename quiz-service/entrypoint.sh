#!/bin/sh
set -e

# The application self-heals its schema and seed data at boot (see app.rb
# `configure` block), so we can start the server directly.
echo "[quiz-service] Starting server..."
exec bundle exec rackup config.ru -s puma -o 0.0.0.0 -p 8004
