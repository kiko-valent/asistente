#!/bin/sh
# Set up gog Google Workspace auth on container start
# The gogcli-config volume must contain credentials.json and refresh_token.json

GOG_CONFIG_DIR=/app/gogcli-config

if [ -f "$GOG_CONFIG_DIR/credentials.json" ] && [ -f "$GOG_CONFIG_DIR/refresh_token.json" ]; then
  echo "[entrypoint] Configuring gog auth..."
  gog auth keyring file
  gog auth credentials "$GOG_CONFIG_DIR/credentials.json"
  gog auth tokens import "$GOG_CONFIG_DIR/refresh_token.json"
  echo "[entrypoint] gog auth ready"
else
  echo "[entrypoint] WARNING: gogcli-config not found — Google Workspace tools will not work"
fi

exec node dist/index.js
