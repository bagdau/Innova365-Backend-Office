FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# devDependencies нужны для tsc, prisma CLI и tsx (seed)
RUN npm ci --include=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 3001
# Применяем миграции и запускаем сервер
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
