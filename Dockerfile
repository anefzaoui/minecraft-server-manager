FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/public ./public
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/CHANGELOG.md ./CHANGELOG.md
EXPOSE 8080
ENV PORT=8080
ENV DATA_DIR=/data
ENV TZ=UTC
VOLUME ["/data"]
USER node
CMD ["npm", "start"]
