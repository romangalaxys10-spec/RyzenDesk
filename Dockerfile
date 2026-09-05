# ── RyzenDesk — production Dockerfile ────────────────────────────────
# Build:  docker build -t ryzendesk .
# Run:    docker run -p 3000:3000 --env-file .env -v ryzendesk-data:/app/data ryzendesk

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:./custom.db
RUN bun run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S ryzendesk && adduser -S ryzendesk -G ryzendesk

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Persistent state: JSON database + bot offset live here
RUN mkdir -p /app/data && chown -R ryzendesk:ryzendesk /app
VOLUME ["/app/data"]
USER ryzendesk

EXPOSE 3000
CMD ["node", "server.js"]
