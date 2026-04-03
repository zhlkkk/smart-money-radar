#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npx tsx src/scripts/backtest/cli.ts "$@"
