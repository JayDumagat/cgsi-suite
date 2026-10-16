FROM nginx:1.29-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY infra/nginx/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
