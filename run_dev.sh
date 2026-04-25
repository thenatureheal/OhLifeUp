#!/usr/bin/env bash
# ═══════════════════════════════════════════════════
#  OhLifeUp — Dev Server Launcher (Ubuntu / macOS)
#  Usage: chmod +x run_dev.sh && ./run_dev.sh
# ═══════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_DIR="$SCRIPT_DIR/venv"

# ── Check required tools ─────────────────────────────────────────────────────
command -v python3 >/dev/null 2>&1 || { echo "❌  python3 is required. Install with: sudo apt install python3 python3-venv"; exit 1; }
command -v node    >/dev/null 2>&1 || { echo "❌  Node.js is required. Install from: https://nodejs.org"; exit 1; }
command -v npm     >/dev/null 2>&1 || { echo "❌  npm is required. Install with: sudo apt install npm"; exit 1; }

# ── 1. Python venv ───────────────────────────────────────────────────────────
if [ ! -d "$VENV_DIR" ]; then
  echo "📦  Creating Python virtual environment..."
  python3 -m venv "$VENV_DIR"
fi

echo "📦  Installing backend dependencies..."
"$VENV_DIR/bin/pip" install -q --upgrade pip
"$VENV_DIR/bin/pip" install -q -r "$BACKEND_DIR/requirements.txt"

# ── 2. Node modules ──────────────────────────────────────────────────────────
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "📦  Installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
fi

# ── 3. Local IP ──────────────────────────────────────────────────────────────
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

# ── 4. Shutdown handler ──────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "🛑  Stopping servers..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  echo "✅  Done."
}
trap cleanup INT TERM

# ── 5. Launch servers ────────────────────────────────────────────────────────
echo ""
echo "🚀  Starting Backend  (FastAPI on :8000)..."
(cd "$BACKEND_DIR" && "$VENV_DIR/bin/uvicorn" main:app --reload --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!

echo "🚀  Starting Frontend (Vite on :5173)..."
(cd "$FRONTEND_DIR" && npm run dev -- --host) &
FRONTEND_PID=$!

sleep 2
echo ""
echo "══════════════════════════════════════"
echo "  ✅  OhLifeUp is running!"
echo "──────────────────────────────────────"
echo "  Local:   http://localhost:5173"
[ -n "$LOCAL_IP" ] && echo "  Network: http://$LOCAL_IP:5173"
echo "──────────────────────────────────────"
echo "  API:     http://localhost:8000"
echo "  API Docs:http://localhost:8000/docs"
echo "══════════════════════════════════════"
echo ""
echo "  Press Ctrl+C to stop all servers."
echo ""

wait
