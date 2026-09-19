#!/usr/bin/env bash
# Restart the dev server safely on this machine.
#   1. every node process must be gone BEFORE .next is deleted, or Next
#      rebuilds into a half-removed directory and every route 500s with
#      "Cannot find module .../[turbopack]_runtime.js";
#   2. IPv4 is forced because this machine has no IPv6 route and node's
#      happy-eyeballs otherwise picks a dead address for Postgres.
set -u
cd /c/dev/calanthe
taskkill //F //IM node.exe >/dev/null 2>&1 || true
sleep 4
rm -rf .next
( NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection" \
  pnpm dev > "$1" 2>&1 & )
for i in $(seq 1 12); do
  sleep 12
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 90 http://localhost:3000/ 2>/dev/null)
  if [ "$code" = "200" ]; then echo "ready after ~$((i*12))s"; exit 0; fi
done
echo "NOT READY (last: ${code:-none})"; exit 1
