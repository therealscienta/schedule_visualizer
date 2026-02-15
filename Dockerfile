# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Build tools required to compile native addons (better-sqlite3, bcrypt)
RUN apk add --no-cache python3 make g++

# Frontend deps (layer cached until package files change)
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Backend deps (layer cached until server/package files change)
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci

# Build frontend
WORKDIR /app
COPY index.html tsconfig.json tsconfig.node.json vite.config.ts postcss.config.js tailwind.config.js ./
COPY src/ ./src/
RUN npm run build

# Build backend, then prune to production deps only
WORKDIR /app/server
COPY server/tsconfig.json ./
COPY server/src/ ./src/
RUN npm run build && npm prune --omit=dev

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist                ./dist
COPY --from=builder /app/server/dist         ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
