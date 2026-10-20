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

# ── 3. итоговый образ: один порт 8200 — API + интерфейс ─────
FROM node:20-alpine
# pg_dump / psql той же ветки, что и сервер PostgreSQL 16 — для резервных копий и импорта
RUN apk add --no-cache postgresql16-client tini
WORKDIR /app
ENV NODE_ENV=production PORT=8200 PUBLIC_DIR=/app/public
COPY --from=api /api/node_modules ./node_modules
COPY --from=api /api/dist ./dist
COPY --from=api /api/package.json ./package.json
COPY --from=web /web/dist ./public
USER node
EXPOSE 8200
HEALTHCHECK --interval=30s --timeout=4s --retries=3 CMD wget -qO- http://127.0.0.1:8200/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
