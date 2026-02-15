# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Build backend
FROM node:22-alpine AS backend-build

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/ .
RUN npm run build

# Stage 3: Production
FROM node:22-alpine

WORKDIR /app

# Copy backend build and dependencies
COPY --from=backend-build /app/server/dist ./server/dist
COPY --from=backend-build /app/server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev
WORKDIR /app

# Copy frontend build
COPY --from=frontend-build /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
