#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$PROJECT_DIR/server"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_PORT=8000
FRONTEND_PORT=5173

cleanup() {
  kill "${BACKEND_PID:-}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

killport "$BACKEND_PORT" 2>/dev/null || true
killport "$FRONTEND_PORT" 2>/dev/null || true

# Start FastAPI backend in background
cd "$SERVER_DIR"
uvicorn api:app --host 0.0.0.0 --port "$BACKEND_PORT" &
BACKEND_PID=$!

# Wait for backend to be ready
for _ in $(seq 1 30); do
  if curl -s "http://localhost:$BACKEND_PORT/api/health" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Start the React frontend (Vite dev server, foreground)
cd "$FRONTEND_DIR"
if [ ! -d node_modules ]; then
  npm install
fi

npm run dev
