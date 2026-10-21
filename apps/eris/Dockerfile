FROM node:24-alpine AS build
WORKDIR /workspace
COPY apps/eris/package.json apps/eris/package-lock.json ./apps/eris/
RUN cd apps/eris && npm ci
COPY apps/eris ./apps/eris
COPY packages ./packages
RUN cd apps/eris && npm run build

FROM nginx:1.29-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY apps/eris/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/eris/dist /usr/share/nginx/html/eris
EXPOSE 80
