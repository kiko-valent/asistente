#!/bin/sh
set -e
# Set up gog Google Workspace auth from environment variables
# GOG_CREDENTIALS_JSON and GOG_REFRESH_TOKEN_JSON must be set in .env

if [ -n "$GOG_CREDENTIALS_JSON" ] && [ -n "$GOG_REFRESH_TOKEN_JSON" ]; then
  echo "[entrypoint] Configuring gog auth from environment..."

  SETUP_DIR=/tmp/gogcli-setup
  mkdir -p "$SETUP_DIR"
  printf '%s' "$GOG_CREDENTIALS_JSON"  > "$SETUP_DIR/credentials.json"
  printf '%s' "$GOG_REFRESH_TOKEN_JSON" > "$SETUP_DIR/refresh_token.json"

  echo "[entrypoint] Setting keyring to file..."
  gog auth keyring file 2>&1

  echo "[entrypoint] Registering OAuth credentials..."
  gog auth credentials "$SETUP_DIR/credentials.json" 2>&1

  echo "[entrypoint] Importing tokens..."
  gog auth tokens import "$SETUP_DIR/refresh_token.json" 2>&1

  rm -rf "$SETUP_DIR"

  echo "[entrypoint] Verifying auth state..."
  gog auth list 2>&1 || echo "[entrypoint] WARNING: gog auth list failed"

  echo "[entrypoint] gog auth done"
else
  echo "[entrypoint] WARNING: GOG_CREDENTIALS_JSON or GOG_REFRESH_TOKEN_JSON not set — Google Workspace tools disabled"
fi

exec node dist/index.js
