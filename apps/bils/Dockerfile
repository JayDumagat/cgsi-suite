FROM node:24-alpine AS build
WORKDIR /workspace
COPY apps/bils/package.json apps/bils/package-lock.json ./apps/bils/
RUN cd apps/bils && npm ci
COPY apps/bils ./apps/bils
COPY packages ./packages
RUN cd apps/bils && npm run build

FROM nginx:1.29-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY apps/bils/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/bils/dist /usr/share/nginx/html/billing
EXPOSE 80
