# ─────────────────────────────────────────────────────────────────────────────
# GAB System — Production Dockerfile
# Multi-stage build: build frontend + bundle backend, then produce slim image.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install all dependencies ────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

RUN npm install -g pnpm@9 --quiet

# Copy workspace manifests first (better layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Library packages
COPY lib/db/package.json             lib/db/
COPY lib/api-spec/package.json       lib/api-spec/
COPY lib/api-zod/package.json        lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/

# Artifact packages
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/web/package.json        artifacts/web/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build everything ─────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

# Copy source
COPY lib/                  lib/
COPY artifacts/api-server/ artifacts/api-server/
COPY artifacts/web/        artifacts/web/

# attached_assets may be referenced by @assets alias in the frontend
COPY attached_assets/      attached_assets/

# Build frontend (static files → artifacts/web/dist/public)
# BASE_PATH=/ for standalone deployment at root
ENV NODE_ENV=production
ENV BASE_PATH=/
ENV PORT=3000
RUN pnpm --filter @workspace/web run build

# Build backend (esbuild bundle → artifacts/api-server/dist/index.cjs)
RUN pnpm --filter @workspace/api-server run build

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:24-alpine AS production
WORKDIR /app

# Install pnpm (needed only to install production node_modules)
RUN npm install -g pnpm@9 --quiet

# Copy workspace manifests for production install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json             lib/db/
COPY lib/api-spec/package.json       lib/api-spec/
COPY lib/api-zod/package.json        lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY artifacts/api-server/package.json artifacts/api-server/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=builder /app/artifacts/web/dist/public  ./public

# Tell the server to serve the frontend from /app/public
ENV FRONTEND_STATIC_DIR=/app/public

# Uploads volume — mount this in Dokploy as a persistent volume
# so that files survive container rebuilds and restarts
ENV UPLOADS_DIR=/app/uploads
RUN mkdir -p /app/uploads/gallery /app/uploads/receipts

# Expose port (Dokploy will inject PORT via env)
ENV PORT=3000
EXPOSE 3000

ENV NODE_ENV=production

# Run the bundled server
CMD ["node", "artifacts/api-server/dist/index.cjs"]
