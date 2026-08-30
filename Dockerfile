ARG NODE_BASE_IMAGE=node:20-slim
FROM ${NODE_BASE_IMAGE} AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_NETWORK_TIMEOUT=300000

FROM base AS deps

COPY package.json package-lock.json* ./
COPY src/server/prisma ./src/server/prisma

RUN npm ci --include=optional --prefer-offline

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_OPTIONS=--max-old-space-size=4096

RUN npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3333
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/server/prisma ./src/server/prisma
COPY --from=builder /app/src/common/models ./src/common/models
COPY --from=builder /app/docker ./docker

RUN rm -f ./docker/print-model-route-summary.ts \
  && chmod +x ./docker/start-frontend.sh

USER nextjs

EXPOSE 3333

CMD ["./docker/start-frontend.sh"]
