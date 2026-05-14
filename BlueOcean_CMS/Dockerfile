# syntax=docker/dockerfile:1.7
# BlueOcean CMS — frontend (Vite/React, served via nginx)

# ----------- Stage 1: build -----------
FROM node:20-alpine AS build
WORKDIR /app

# Bake the backend URL into the bundle at build time.
# Coolify: pass this as a Build Argument (Settings → Build → Build Arguments).
ARG VITE_BACKEND_URL=http://localhost:3001
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

COPY package.json package-lock.json* ./
# Use install (not ci) so newly-added deps resolve even if the lockfile is stale.
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build
# Vite is configured to emit to `build/` (see vite.config.ts).

# ----------- Stage 2: serve -----------
FROM nginx:1.27-alpine AS runner
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
