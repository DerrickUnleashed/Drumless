#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/server"

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

# Start Gradio desktop UI in foreground (blocks)
python app.py

# On exit, kill backend
kill "$BACKEND_PID" 2>/dev/null || true