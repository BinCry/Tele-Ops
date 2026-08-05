# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.13.1

FROM node:${NODE_VERSION}-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends dumb-init postgresql-client \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY . .
RUN pnpm prisma:generate
RUN pnpm build

FROM build AS runtime-deps

RUN pnpm prune --prod

FROM base AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=runtime-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/config ./config
COPY --from=build /app/scripts ./scripts

RUN useradd --system --create-home --uid 1001 teleops \
  && mkdir -p /data/backups \
  && chown -R teleops:teleops /app /data/backups

USER teleops

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "pnpm prisma:migrate:deploy && node dist/src/main.js"]
