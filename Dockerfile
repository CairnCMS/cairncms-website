FROM node:22-alpine AS build
WORKDIR /app

RUN apk add --no-cache git

COPY package*.json ./
RUN npm ci
COPY . .

ARG DOCS_SHA=main
RUN git clone --filter=blob:none https://github.com/CairnCMS/cairncms.git /tmp/cairncms && \
    cd /tmp/cairncms && \
    git checkout "$DOCS_SHA" && \
    mkdir -p /app/src/content/docs/docs && \
    find /app/src/content/docs/docs -mindepth 1 -delete && \
    cp -a docs/. /app/src/content/docs/docs/ && \
    rm -rf /tmp/cairncms

RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile
