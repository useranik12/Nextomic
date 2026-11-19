import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "./client";

async function main() {
  const db = getDb();
  // Use a session-mode connection (the pooler's session port or the database itself), never the
  // transaction pooler: migrations run several statements that need one connection.
  await migrate(db, {
    migrationsFolder: "./migrations",
    migrationsSchema: "nextomic_builder",
    migrationsTable: "__drizzle_migrations"
  });
  // eslint-disable-next-line no-console
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
