FROM node:24-alpine AS build

WORKDIR /app

COPY frontend/cube-portal/package.json frontend/cube-portal/package-lock.json ./
RUN npm ci

COPY frontend/cube-portal/ ./
RUN npm run build

FROM nginx:1.29-alpine

COPY frontend/cube-portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
