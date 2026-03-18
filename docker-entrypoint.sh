#!/bin/sh
# Set up gog Google Workspace auth from environment variables
# GOG_CREDENTIALS_JSON and GOG_REFRESH_TOKEN_JSON must be set in .env

if [ -n "$GOG_CREDENTIALS_JSON" ] && [ -n "$GOG_REFRESH_TOKEN_JSON" ]; then
  echo "[entrypoint] Configuring gog auth from environment..."

  SETUP_DIR=/tmp/gogcli-setup
  mkdir -p "$SETUP_DIR"
  printf '%s' "$GOG_CREDENTIALS_JSON"  > "$SETUP_DIR/credentials.json"
  printf '%s' "$GOG_REFRESH_TOKEN_JSON" > "$SETUP_DIR/refresh_token.json"

  gog auth keyring file
  gog auth credentials "$SETUP_DIR/credentials.json"
  gog auth tokens import "$SETUP_DIR/refresh_token.json"

  rm -rf "$SETUP_DIR"
  echo "[entrypoint] gog auth ready"
else
  echo "[entrypoint] WARNING: GOG_CREDENTIALS_JSON or GOG_REFRESH_TOKEN_JSON not set — Google Workspace tools disabled"
fi

exec node dist/index.js
