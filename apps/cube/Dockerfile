FROM node:24-alpine AS build
WORKDIR /workspace
COPY apps/cube/package.json apps/cube/package-lock.json ./apps/cube/
RUN cd apps/cube && npm ci
COPY apps/cube ./apps/cube
COPY packages ./packages
RUN cd apps/cube && npm run build

FROM nginx:1.29-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY apps/cube/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/cube/dist /usr/share/nginx/html
EXPOSE 80
