# ============================================================
# Stage 1: Build
# ============================================================
FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies first (leverages Docker layer cache)
COPY package*.json ./
RUN npm ci

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ============================================================
# Stage 2: Runtime (lean image)
# ============================================================
FROM node:22-slim AS runtime

WORKDIR /app

# Install curl + ca-certificates to download gog, then clean up
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://github.com/steipete/gogcli/releases/download/v0.12.0/gogcli_0.12.0_linux_amd64.tar.gz \
       | tar -xz -C /usr/local/bin gog \
    && chmod +x /usr/local/bin/gog \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create required directories
RUN mkdir -p data .tmp

# The SQLite database lives in /app/data — mount as a volume
# to persist data across container restarts and redeployments
VOLUME ["/app/data"]

ENTRYPOINT ["/entrypoint.sh"]
