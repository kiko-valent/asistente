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

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Create required directories
RUN mkdir -p data .tmp

# The SQLite database lives in /app/data — mount as a volume
# to persist data across container restarts and redeployments
VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
