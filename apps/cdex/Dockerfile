FROM node:24-alpine AS build
WORKDIR /workspace
COPY apps/cdex/package.json apps/cdex/package-lock.json ./apps/cdex/
RUN cd apps/cdex && npm ci
COPY apps/cdex ./apps/cdex
COPY packages ./packages
RUN cd apps/cdex && npm run build

FROM nginx:1.29-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY apps/cdex/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/cdex/dist /usr/share/nginx/html/crm
EXPOSE 80
