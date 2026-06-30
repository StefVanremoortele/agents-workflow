#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";

const dbPath = resolve(process.env.HARNESS_DB_PATH ?? ".harness/harness.db");
const keepRules = process.argv.includes("--keep-rules");

if (!existsSync(dbPath)) {
  console.log(`No harness database found at ${dbPath}`);
  process.exit(0);
}

const db = new Database(dbPath);

try {
  const existingTables = new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name),
  );

  const tablesToClear = ["events", "agents", "tasks", "alerts", "conclusions"];
  if (!keepRules) tablesToClear.push("rules");

  const clearTables = db.transaction(() => {
    for (const table of tablesToClear) {
      if (existingTables.has(table)) {
        db.prepare(`DELETE FROM ${table}`).run();
      }
    }
  });

  clearTables();
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.exec("VACUUM");

  const cleared = tablesToClear.filter((table) => existingTables.has(table));
  console.log(`Cleared ${cleared.length ? cleared.join(", ") : "no known tables"} from ${dbPath}`);
  if (keepRules && existingTables.has("rules")) {
    console.log("Kept trigger rules (--keep-rules).");
  }
} finally {
  db.close();
}
