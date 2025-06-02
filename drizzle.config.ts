import { defineConfig } from "drizzle-orm/cli";
import { join } from "path";

export default defineConfig({
  schema: "./src/index.js",
  out: "./drizzle/migrations",
  driver: "better-sqlite3",
  dbCredentials: {
    url: "file:./drizzle/db.sqlite"
  }
});
