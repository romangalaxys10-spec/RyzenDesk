# ── RyzenDesk — production Dockerfile ────────────────────────────────
# Multi-stage build for the Vite 6 + Express stack.
#   Build:  docker build -t ryzendesk .
#   Run:    docker run -p 3000:3000 --env-file .env -v ryzendesk-data:/app/data ryzendesk
#
# Build pipeline (package.json "build"):
#   1. vite build           -> dist/            (SPA assets)
#   2. esbuild server.ts    -> dist/server.cjs  (Express server, deps external)

# ── Stage 1: full dependency install (build toolchain included) ──
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: compile the SPA bundle and the server bundle ──
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: production-only dependencies (runtime) ──
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 4: minimal runtime image ──
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup -S ryzendesk && adduser -S ryzendesk -G ryzendesk

# Server bundle (Express + compiled client assets)
COPY --from=builder /app/dist ./dist
# Runtime dependencies (express etc. are external in dist/server.cjs)
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./

# Persistent state: JSON database + installation lock live here
RUN mkdir -p /app/data && chown -R ryzendesk:ryzendesk /app
VOLUME ["/app/data"]
USER ryzendesk

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null 2>&1 || exit 1

CMD ["node", "dist/server.cjs"]
