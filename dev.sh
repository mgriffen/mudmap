#!/usr/bin/env bash
# dev.sh — start both the FastAPI backend and Vite frontend in development mode.
#
# Usage:
#   ./dev.sh
#
# Requires:
#   - uv (Python project manager)
#   - node + npm (for the frontend)
#
# The backend runs on :8000 and the frontend dev server on :5173.
# Vite proxies /api/* to the backend automatically.

set -e

# Trap Ctrl+C and kill both background processes
cleanup() {
  echo ""
  echo "Stopping mudmap..."
  kill 0
}
trap cleanup SIGINT SIGTERM

# Start the FastAPI backend
echo "Starting FastAPI backend on http://localhost:8000"
PYTHONPATH=src uv run uvicorn mudmap.main:app --reload --reload-dir src &

# Start the Vite frontend dev server
echo "Starting Vite frontend on http://localhost:5173"
cd frontend && npm run dev &

# Wait for both
wait
