# syntax=docker/dockerfile:1
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/editor/package.json apps/editor/package.json
COPY packages/schema/package.json packages/schema/package.json
COPY packages/renderer/package.json packages/renderer/package.json
COPY packages/css-framework/package.json packages/css-framework/package.json
COPY packages/runtime/package.json packages/runtime/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/storage/package.json packages/storage/package.json
# Root postinstall (icons:build) and husky need the full source tree / .git, so they run later.
RUN bun install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY . .
# Next evaluates route modules while collecting page data, and lib/auth.ts builds its DB pool at
# import time. These placeholders exist only for this RUN (not persisted in the image); no
# connection is opened during the build, and real values come from the container environment.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder \
    bun run icons:build && \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder \
    bun run --filter editor build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/editor/node_modules ./apps/editor/node_modules
COPY --from=build /app/apps/editor/.next ./apps/editor/.next
COPY --from=build /app/apps/editor/public ./apps/editor/public
COPY --from=build /app/apps/editor/package.json ./apps/editor/package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/assets ./assets
COPY --from=build /app/builder-dependencies.json ./builder-dependencies.json
EXPOSE 3000
WORKDIR /app/apps/editor
CMD ["bun", "run", "start"]
