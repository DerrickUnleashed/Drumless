#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$PROJECT_DIR/server"
CLIENT_DIR="$PROJECT_DIR/client/src"

cd "$SERVER_DIR"

killport 8000 2>/dev/null || true

# Start FastAPI backend in background
uvicorn api:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready
for i in $(seq 1 30); do
  if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Start static frontend server in background
cd "$CLIENT_DIR"
python3 -m http.server 3000 &
FRONTEND_PID=$!

# Wait for frontend to be ready
for i in $(seq 1 10); do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Start Gradio desktop UI in foreground (blocks)
python app.py

# On exit, kill all background processes
kill "$BACKEND_PID" 2>/dev/null || true
kill "$FRONTEND_PID" 2>/dev/null || true