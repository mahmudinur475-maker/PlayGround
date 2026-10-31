#!/usr/bin/env bash
# start.sh — build static output inside PROJECT_DIR, write deployment metadata,
# and serve the built directory in the foreground on PORT (default 3000).
set -euo pipefail

cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"
PORT="${PORT:-3000}"
export PORT

echo "[start] PROJECT_DIR=$PROJECT_DIR PORT=$PORT"

# ---- Build: static output inside PROJECT_DIR/dist ----
/usr/bin/time -p mkdir -p dist
/usr/bin/time -p cp PlayBoard-turnamen-catur.html dist/index.html
echo "[start] built dist/index.html"

# ---- Worker metadata (capture evidence) only — outside source tree ----
WEB_DIR="${OPENCODE_WEB_DIR:-$PROJECT_DIR/node_modules/.cache}"
/usr/bin/time -p mkdir -p "$WEB_DIR"
/usr/bin/time -p printf '%s' '{"project":"'"$PROJECT_DIR"'","directory":"'"$PROJECT_DIR/dist"'"}' > "$WEB_DIR/deployment-output.json"
echo "[start] wrote $WEB_DIR/deployment-output.json"

# ---- Serve static output in the foreground on PORT ----
echo "[start] serving dist on http://0.0.0.0:$PORT"
/usr/bin/time -p python3 -m http.server "$PORT" --bind 0.0.0.0 --directory dist
