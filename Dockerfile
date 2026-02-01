FROM node:20-slim

WORKDIR /app

COPY server/package.json ./
RUN npm install --production

COPY server/index.js ./

RUN mkdir -p /app/data/yjs-docs

ENV PORT=4000
ENV HOST=0.0.0.0
ENV DB_DIR=/app/data/yjs-docs
ENV MAX_ROOMS=200

EXPOSE 4000

VOLUME ["/app/data"]

CMD ["node", "index.js"]
