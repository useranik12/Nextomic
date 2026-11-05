import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "./client";

async function main() {
  const db = getDb();
  await migrate(db, { migrationsFolder: "./migrations" });
  // eslint-disable-next-line no-console
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
