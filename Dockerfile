# Panel image. The panel drives the HOST's Docker daemon and creates Minecraft
# servers as SIBLING containers - run it with the Docker socket mounted and
# DATA_DIR_HOST set to the host path of the /data mount (see docker-compose.yml).

# Build stage: full install (Tailwind lives in devDependencies), then compile
# the CSS bundle. scripts/ must exist before npm ci - the postinstall hook runs
# node scripts/postinstall.js, and MSM_SKIP_POSTINSTALL is honored inside that
# file. The bundle is built explicitly after the full source copy.
FROM node:24-alpine AS build
WORKDIR /app
ENV MSM_SKIP_POSTINSTALL=1
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: production deps + the app, with the built CSS overlaid.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    MSM_SKIP_POSTINSTALL=1 \
    DATA_DIR=/data \
    PANEL_HOST=0.0.0.0 \
    PANEL_PORT=25564
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci --omit=dev
COPY src ./src
COPY views ./views
COPY --from=build /app/public ./public
EXPOSE 25564
VOLUME /data
# Runs as root: the mounted Docker socket needs it (the host's docker-group GID
# is unknowable at build time), and a socket-holding container is already
# root-equivalent on the host - dropping privileges here would only pretend.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PANEL_PORT}/login" || exit 1
CMD ["node", "src/server.js"]
