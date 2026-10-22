FROM node:24-alpine AS build

WORKDIR /app
COPY frontend/hris-portal/package.json frontend/hris-portal/package-lock.json ./
RUN npm ci
COPY frontend/hris-portal/ ./
RUN npm run build

FROM nginx:1.29-alpine
COPY frontend/hris-portal/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
