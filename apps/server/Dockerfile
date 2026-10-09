# Build from the repository root:  docker build -f apps/server/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @ozu/server --include-workspace-root
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build -w @ozu/server

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=2567 DATA_DIR=/data
COPY --from=build /app/apps/server/package.json ./
RUN npm pkg delete devDependencies && npm install --omit=dev --no-audit --no-fund && mkdir -p /data && chown node:node /data
COPY --from=build /app/apps/server/dist ./dist
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1
CMD ["node", "dist/index.js"]
