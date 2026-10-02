# Multi-stage Docker build for TogglePulse
FROM node:24-alpine AS base
WORKDIR /app

# Stage 1: build client and server
FROM base AS builder
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci

COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/

RUN npm run build

# Stage 2: production runtime
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000

COPY package.json ./
COPY server/package.json ./server/
COPY --from=builder /app/node_modules ./node_modules
# server/dist already contains the compiled shared/ modules (tsc's rootDir
# spans both server/src and ../shared), so shared/ is not copied again.
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# The server resolves client/dist and data/ relative to the working directory
# (/app). The SQLite file lives in /app/data, which the compose file mounts as
# a volume; it must be writable by the unprivileged "node" user.
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 4000

CMD ["node", "server/dist/server/src/index.js"]
