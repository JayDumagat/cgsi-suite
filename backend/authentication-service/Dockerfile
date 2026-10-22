FROM node:24-alpine AS build

WORKDIR /workspace/backend/authentication-service
COPY backend/authentication-service/package.json backend/authentication-service/package-lock.json ./
RUN npm ci
COPY backend/authentication-service/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /workspace/backend/authentication-service/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/backend/authentication-service/package.json ./package.json
COPY --from=build --chown=node:node /workspace/backend/authentication-service/dist ./dist
USER node
EXPOSE 8081
CMD ["node", "dist/index.js"]
