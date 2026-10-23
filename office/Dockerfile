# ── 1. фронтенд ─────────────────────────────────────────────
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── 2. бэкенд ───────────────────────────────────────────────
FROM node:20-alpine AS api
WORKDIR /api
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

# ── 3. итоговый образ: один порт 8300 — API + интерфейс ─────
FROM node:20-alpine
RUN apk add --no-cache tini tar postgresql16-client
WORKDIR /app
ENV NODE_ENV=production PORT=8300 PUBLIC_DIR=/app/public MIGRATIONS_DIR=/app/migrations DATA_DIR=/data
COPY --from=api /api/node_modules ./node_modules
COPY --from=api /api/dist ./dist
COPY --from=api /api/migrations ./migrations
COPY --from=api /api/package.json ./package.json
COPY --from=web /web/dist ./public
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8300
HEALTHCHECK --interval=30s --timeout=4s --retries=3 CMD wget -qO- http://127.0.0.1:8300/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
