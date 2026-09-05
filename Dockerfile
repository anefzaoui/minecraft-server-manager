# Panel image. The panel drives the HOST's Docker daemon and creates Minecraft
# servers as SIBLING containers - run it with the Docker socket mounted and
# DATA_DIR_HOST set to the host path of the /data mount (see docker-compose.yml).

# Build stage: full install (Tailwind + esbuild live in devDependencies), then
# `pnpm run build` compiles the CSS bundle AND the esbuild client-JS bundle
# (public/dist/js). scripts/ must exist before pnpm install - the postinstall
# hook runs node scripts/postinstall.js, and MSM_SKIP_POSTINSTALL is honored
# inside that file. The bundles are built explicitly after the full source copy.
FROM node:24-alpine AS build
WORKDIR /app
ARG PNPM_VERSION=11.25.0
ENV MSM_SKIP_POSTINSTALL=1
# Pin pnpm directly instead of corepack (deprecated, being removed from Node):
# exact packageManager version, no shim, no second download.
RUN npm install -g pnpm@${PNPM_VERSION}
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts ./scripts
# Cache-mount the pnpm store so installs are incremental; the runtime stage
# shares this store id, so its --prod install reuses what was already fetched.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
# Build inputs only (Tailwind scans assets/views/public for classes; src/ has
# none, the app doesn't build from it) so a src-only change cache-hits this
# RUN layer instead of re-running Tailwind + esbuild.
COPY assets ./assets
COPY views ./views
COPY public ./public
RUN pnpm run build
COPY src ./src

# Runtime stage: production deps + the app, with the built CSS + JS bundles overlaid.
FROM node:24-alpine
WORKDIR /app
ARG PNPM_VERSION=11.25.0
# LOG_PRETTY=false: logs are newline-delimited JSON on stdout for the container
# runtime to collect; the pretty transport is a dev-only convenience.
ENV NODE_ENV=production \
    MSM_SKIP_POSTINSTALL=1 \
    DATA_DIR=/data \
    PANEL_HOST=0.0.0.0 \
    PANEL_PORT=25564 \
    LOG_PRETTY=false
RUN npm install -g pnpm@${PNPM_VERSION}
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts ./scripts
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod
COPY src ./src
COPY views ./views
COPY --from=build /app/public ./public
EXPOSE 25564
VOLUME /data
# Runs as root: the mounted Docker socket needs it (the host's docker-group GID
# is unknowable at build time), and a socket-holding container is already
# root-equivalent on the host - dropping privileges here would only pretend.
# /healthz is unauthenticated, checks the DB, and returns 503 on failure - a
# truer liveness signal than /login (which only proves the HTTP listener is up).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PANEL_PORT}/healthz" || exit 1
CMD ["node", "src/server.js"]
