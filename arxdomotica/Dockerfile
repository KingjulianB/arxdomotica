ARG BUILD_FROM
FROM $BUILD_FROM

# Node.js runtime for the add-on backend (Alpine-based HA add-on base image)
RUN apk add --no-cache nodejs npm

WORKDIR /app

# --- Frontend build ---
COPY web/package*.json ./web/
RUN cd web && npm ci
COPY web/ ./web/
RUN cd web && npm run build

# --- Backend build ---
COPY server/package*.json ./server/
RUN cd server && npm ci
COPY server/ ./server/
RUN cd server && npm run build && npm prune --omit=dev

COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
