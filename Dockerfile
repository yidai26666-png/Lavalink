FROM alpine:3.20

RUN apk add --no-cache \
    bash \
    curl \
    ca-certificates \
    procps \
    tzdata \
    python3

WORKDIR /app

# Download the Wanju Go binary at build time (4.5MB)
RUN curl -fL \
    "https://github.com/dsadsadsss/Cloudflare-Navihive/releases/download/1/go-server-linux-amd64.bin" \
    -o /usr/local/bin/wanju \
    && chmod 755 /usr/local/bin/wanju

# Create health check page
RUN mkdir -p /www \
    && echo '<!DOCTYPE html><html><body><h1>Shiper Wanju Node</h1><p>Service is running.</p></body></html>' > /www/index.html

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

ENV PORT=3000 \
    TMP_ARGO=vms \
    VM_PORT=8040 \
    VL_PORT=8002 \
    CF_IP=ip.sb \
    SUB_NAME=Shiper \
    NEZHA_TLS=1 \
    TG="" \
    SUB_URL=""

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
