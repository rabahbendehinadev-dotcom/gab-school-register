# ─────────────────────────────────────────────────────────────────────────────
# GAB System — Production Dockerfile (Multi-stage)
#
# Analysis: the esbuild bundle only has ONE external npm runtime dependency:
#   web-push@3.6.7
# Everything else (express, pg, drizzle-orm, cors, multer, session, zod…)
# is fully bundled. This keeps the final image very small.
#
# Uses Debian-based Node (not Alpine) to avoid musl/glibc binary issues
# with native tooling (esbuild, @tailwindcss/oxide) used during the build.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install all dependencies ─────────────────────────────────────────
FROM node:24 AS deps
WORKDIR /app

# Match the pnpm version used in the workspace
RUN npm install -g pnpm@10 --quiet

# Copy workspace-level manifests first (best Docker layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json tsconfig.json ./

# Library package manifests
COPY lib/db/package.json               lib/db/
COPY lib/api-spec/package.json         lib/api-spec/
COPY lib/api-zod/package.json          lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/

# Artifact + scripts manifests
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/web/package.json        artifacts/web/
COPY scripts/package.json              scripts/

# Install everything (devDeps needed for build tools: vite, esbuild, tsx…)
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build frontend + backend ─────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

# Copy all source files (tsconfig files are included inside each directory)
COPY lib/                  lib/
COPY artifacts/api-server/ artifacts/api-server/
COPY artifacts/web/        artifacts/web/
COPY scripts/              scripts/

# attached_assets — referenced via @assets Vite alias; include so the alias
# resolves cleanly during the build even if nothing in production imports it.
COPY attached_assets/      attached_assets/

# ── Build React/Vite frontend → artifacts/web/dist/public/ ───────────────────
# BASE_PATH=/ → SPA served at root in Dokploy.
# PORT is required by vite.config.ts validation but unused during `vite build`.
ENV NODE_ENV=production \
    BASE_PATH=/ \
    PORT=3000
RUN pnpm --filter @workspace/web run build

# ── Build Express backend bundle → artifacts/api-server/dist/index.cjs ───────
RUN pnpm --filter @workspace/api-server run build

# ── Stage 3: Minimal production image ─────────────────────────────────────────
FROM node:24-slim AS production
WORKDIR /app

# Install the ONLY external npm runtime dependency the bundle needs.
# Everything else (express, pg, drizzle-orm, cors, multer, etc.) is
# fully inlined by esbuild. No pnpm, no workspace — just one package.
RUN npm install --no-save web-push@3.6.7

# Copy the pre-built frontend (served as static files by the API server)
COPY --from=builder /app/artifacts/web/dist/public ./public

# Copy the pre-built server bundle
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

# Pre-create upload directories.
# Mount /app/uploads as a persistent Docker volume in Dokploy so files
# survive container rebuilds and restarts.
RUN mkdir -p /app/uploads/gallery /app/uploads/receipts

# ── Runtime configuration ──────────────────────────────────────────────────────
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOADS_DIR=/app/uploads \
    FRONTEND_STATIC_DIR=/app/public

EXPOSE 3000

# Volume annotation (informational — define the actual volume in Dokploy)
VOLUME ["/app/uploads"]

CMD ["node", "artifacts/api-server/dist/index.cjs"]
