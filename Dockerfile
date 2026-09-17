FROM node:20-alpine3.20
WORKDIR /tmp
ENV UUID=50435f3a-ec1f-4e1a-867c-385128b447f6 \
    ARGO_DOMAIN=shiper.yidai.kdns.fr \
    ARGO_PORT=8040 \
    PORT=3000 \
    NAME=Shiper \
    NEZHA_SERVER=zha.cailuo.ggff.net:443
# ARGO_AUTH and NEZHA_KEY are supplied as Shiper runtime variables.
RUN apk add --no-cache bash openssl curl && npm i node-sbx@2.0.9
EXPOSE 3000
CMD ["npx", "node-sbx"]
