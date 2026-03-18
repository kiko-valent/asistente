#!/bin/sh
# Google auth is handled automatically by the bot via GOG_ACCESS_TOKEN
# (fetched from GOG_CREDENTIALS_JSON + GOG_REFRESH_TOKEN_JSON on each call)
exec node dist/index.js
