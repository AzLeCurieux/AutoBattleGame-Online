# syntax=docker/dockerfile:1
# ---- build: compile shared, web and server -------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime: only compiled output + production deps ---------------------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    APP_ORIGIN=http://localhost:3000 \
    DATABASE_PATH=/data/autobattle.db \
    WEB_DIST=/app/apps/web/dist
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/server/package.json apps/server/
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/dist apps/web/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/server/dist/index.js"]
