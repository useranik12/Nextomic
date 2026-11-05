FROM oven/bun:1.3.14 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/editor/package.json apps/editor/package.json
COPY packages/schema/package.json packages/schema/package.json
COPY packages/renderer/package.json packages/renderer/package.json
COPY packages/css-framework/package.json packages/css-framework/package.json
COPY packages/runtime/package.json packages/runtime/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/storage/package.json packages/storage/package.json
RUN bun install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN bun run build

FROM oven/bun:1.3.14 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["bun", "run", "--filter", "editor", "start"]
