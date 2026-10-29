# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY front/package.json front/package.json
COPY design-system/package.json design-system/package.json
RUN --mount=type=cache,target=/root/.npm npm ci

FROM dependencies AS builder
WORKDIR /app

COPY . .

ARG NEXT_PUBLIC_APP_VERSION
ARG NEXT_PUBLIC_API_MODE=real
ARG BACKEND_ORIGIN=http://backend:3001
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_VERSION=${NEXT_PUBLIC_APP_VERSION} \
    NEXT_PUBLIC_API_MODE=${NEXT_PUBLIC_API_MODE} \
    BACKEND_ORIGIN=${BACKEND_ORIGIN}

RUN test -n "${NEXT_PUBLIC_APP_VERSION}" && test "${NEXT_PUBLIC_API_MODE}" = "real"
RUN npm run build

FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app
COPY --from=builder --chown=node:node /app/front/.next/standalone ./
COPY --from=builder --chown=node:node /app/front/.next/static ./front/.next/static
COPY --from=builder --chown=node:node /app/front/public ./front/public
COPY --from=builder --chown=node:node /app/docs/legal ./docs/legal
RUN mkdir -p /app/front/.next/cache && chown node:node /app/front/.next/cache

USER node
WORKDIR /app/front
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "server.js"]
