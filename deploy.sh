#!/usr/bin/env bash
# ==========================================================================
#  Deploy / redeploy the AMS-DIU Student frontend (Next.js).
#  Requires the shared reverse proxy to already be running
#  (run ./setup.sh in the backend repo once, first).
#
#  Usage:   ./deploy.sh
# ==========================================================================
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Run:  cp .env.example .env  then edit it." >&2
  exit 1
fi

echo ">> Ensuring shared 'web' network exists..."
docker network inspect web >/dev/null 2>&1 || docker network create web

echo ">> Pulling latest code..."
git pull --ff-only || echo "   (skipping git pull — not a fast-forward or no upstream)"

echo ">> Building and starting student frontend..."
docker compose --env-file .env up -d --build

echo ">> Cleaning up dangling images..."
docker image prune -f >/dev/null 2>&1 || true

echo ""
docker compose ps
echo ""
echo "Student deployed -> https://$(grep -E '^STUDENT_DOMAIN=' .env | cut -d= -f2)"
