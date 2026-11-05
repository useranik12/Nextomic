import type { Config } from "drizzle-kit";

// Generation is offline; migration execution still requires a real DATABASE_URL.
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://nextomic:change-me@localhost:5432/nextomic";

export default {
  schema: "./packages/db/src/schema.ts",
  out: "./packages/db/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl }
} satisfies Config;
