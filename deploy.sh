#!/usr/bin/env bash
# Usage: ./deploy.sh [path-to-env-file]
# Default env file: .env.prod
set -euo pipefail

ENV_FILE="${1:-.env.prod}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "  Copy .env.prod.example → $ENV_FILE and fill in all CHANGE_ME values."
  exit 1
fi

# Reject uncustomised secrets
if grep -q "CHANGE_ME" "$ENV_FILE"; then
  echo "ERROR: $ENV_FILE still contains CHANGE_ME placeholders. Fill them in first."
  exit 1
fi

echo "==> Building images..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" build

echo "==> Starting infrastructure (postgres, redis, elasticsearch)..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" \
  up -d postgres redis elasticsearch

echo "==> Waiting for infrastructure to be healthy..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" \
  run --rm migrate

echo "==> Starting application services..."
docker compose -f docker-compose.prod.yml --env-file "$ENV_FILE" \
  up -d api notifications-svc tracking-svc discovery-svc frontend

echo ""
echo "✓ Deployment complete."
echo "  Frontend → http://localhost:80"
echo "  API      → http://localhost:3000"
echo ""
echo "Tail logs:  docker compose -f docker-compose.prod.yml logs -f api frontend"
