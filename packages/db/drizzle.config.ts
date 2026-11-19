import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run drizzle-kit");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl },
  // Only our two schemas. Supabase owns auth, storage, realtime and the rest.
  schemaFilter: ["public", "nextomic_builder"],
  migrations: { schema: "nextomic_builder", table: "__drizzle_migrations" }
});
