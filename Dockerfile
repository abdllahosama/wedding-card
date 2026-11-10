FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html links.html /usr/share/nginx/html/
COPY css   /usr/share/nginx/html/css
COPY js    /usr/share/nginx/html/js
COPY images /usr/share/nginx/html/images
COPY audio /usr/share/nginx/html/audio

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
