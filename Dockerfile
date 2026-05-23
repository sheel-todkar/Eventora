# ── Stage 1: Build React frontend ────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ── Stage 2: Production server ───────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install server dependencies only
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# Copy server source
COPY server/ ./

# Copy built React app from stage 1
COPY --from=builder /app/client/dist ./public

# Expose API port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "index.js"]
