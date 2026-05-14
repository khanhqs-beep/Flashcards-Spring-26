# syntax=docker/dockerfile:1.7
# BlueOcean CMS — backend (Express + PostgreSQL + n8n forwarder)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Non-root user for safety
RUN addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=app:app . .

USER app
EXPOSE 3001

# Healthcheck — Coolify reads HEALTHCHECK and shows status in the dashboard.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

# Run DB migration on container start (idempotent), then launch the API.
CMD ["sh", "-c", "node migrate.js && node server.js"]
