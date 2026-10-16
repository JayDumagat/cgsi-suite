FROM node:24-alpine AS build

WORKDIR /workspace/services/authentication-service
COPY services/authentication-service/package.json services/authentication-service/package-lock.json ./
RUN npm ci
COPY services/authentication-service/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /workspace/services/authentication-service/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/services/authentication-service/package.json ./package.json
COPY --from=build --chown=node:node /workspace/services/authentication-service/dist ./dist
USER node
EXPOSE 8081
CMD ["node", "dist/index.js"]
