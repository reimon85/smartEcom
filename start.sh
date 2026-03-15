#!/bin/bash
# SmartEcom — Script de arranque local
# Uso: bash start.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"

export SQLITE_PATH="$ROOT/smartecom.db"
export OPENAI_API_KEY="${OPENAI_API_KEY:-mock}"
export PORT=3000
export NODE_ENV=development
export CORS_ORIGIN=http://localhost:3001
export NEXT_PUBLIC_API_URL=http://localhost:3000
export OPENAI_INPUT_COST_PER_1K=0.00015
export OPENAI_OUTPUT_COST_PER_1K=0.0006

echo "──────────────────────────────────────────"
echo "  SmartEcom AI Pipeline"
echo "  API  → http://localhost:3000"
echo "  Dashboard → http://localhost:3001"
echo "  Modo IA: ${OPENAI_API_KEY:-mock}"
echo "──────────────────────────────────────────"

# Matar procesos anteriores si existen
kill $(lsof -ti:3000) 2>/dev/null
kill $(lsof -ti:3001) 2>/dev/null
sleep 1

# API en background
node "$ROOT/packages/api/src/index.js" &
API_PID=$!
echo "API arrancada (PID $API_PID)"

# Dashboard en foreground (Ctrl+C para parar todo)
cd "$ROOT/packages/dashboard"
NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL npm run dev

# Al salir del dashboard, matar la API
kill $API_PID 2>/dev/null
