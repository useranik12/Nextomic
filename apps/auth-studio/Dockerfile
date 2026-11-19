# syntax=docker/dockerfile:1
# The standalone auth dashboard (Better Auth Studio). Build context is the repository root:
#   docker build -f apps/auth-studio/Dockerfile .
# It is a small image: no Next.js build, only this service and the workspace packages it imports.
FROM oven/bun:1.4.4 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/editor/package.json apps/editor/package.json
COPY apps/auth-studio/package.json apps/auth-studio/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/schema/package.json packages/schema/package.json
COPY packages/renderer/package.json packages/renderer/package.json
COPY packages/css-framework/package.json packages/css-framework/package.json
COPY packages/runtime/package.json packages/runtime/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/storage/package.json packages/storage/package.json
# Only this service's dependency tree; the root postinstall (icons) is not needed here.
RUN bun install --frozen-lockfile --ignore-scripts --filter auth-studio

# Sources go on top of the installed tree (each workspace keeps its own node_modules).
FROM deps AS build
COPY packages/auth ./packages/auth
COPY packages/db ./packages/db
COPY packages/schema ./packages/schema
COPY apps/auth-studio ./apps/auth-studio

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/auth ./packages/auth
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/packages/schema ./packages/schema
COPY --from=build /app/apps/auth-studio ./apps/auth-studio
EXPOSE 3002
WORKDIR /app/apps/auth-studio
CMD ["bun", "run", "start"]
