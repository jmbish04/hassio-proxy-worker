import { defineConfig } from "drizzle-orm/cli";
import { join } from "path";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  driver: "better-sqlite3",
  dbCredentials: {
    url: "file:./drizzle/db.sqlite"
  }
});