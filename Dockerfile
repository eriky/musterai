# Stage 1: Build Frontend & Backend TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apk add --no-python3 make g++ gcc

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV MUSTER_PORT=3000
ENV MUSTER_HOST=0.0.0.0

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

# Data volume directory for SQLite database persistence
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

CMD ["node", "dist/index.js"]
