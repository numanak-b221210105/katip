#!/usr/bin/env sh
# Kâtip: install and start the dev server (macOS / Linux)
set -e
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
npm run dev -- --open
