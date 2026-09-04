# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM dependencies AS migrator
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
COPY lib/server/database/schema.ts ./lib/server/database/schema.ts
COPY lib/core ./lib/core
COPY config ./config
COPY scripts/provision-tenant.mjs ./scripts/provision-tenant.mjs
COPY scripts/seed-dealership-template.mjs ./scripts/seed-dealership-template.mjs
CMD ["pnpm", "db:migrate"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder --chown=nextjs:nodejs /app/config ./config
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/render-migrate.mjs ./scripts/render-migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/provision-staging-salesperson.mjs ./scripts/provision-staging-salesperson.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/smoke-staging-lead-idempotency.mjs ./scripts/smoke-staging-lead-idempotency.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/smoke-staging-sales-journey.mjs ./scripts/smoke-staging-sales-journey.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed-dealership-template.mjs ./scripts/seed-dealership-template.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed-synthetic-pilot.mjs ./scripts/seed-synthetic-pilot.mjs
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
