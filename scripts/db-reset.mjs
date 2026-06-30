#!/usr/bin/env node

import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const dbPath = resolve(process.env.HARNESS_DB_PATH ?? ".harness/harness.db");
for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  await rm(path, { force: true });
}
console.log(`Removed harness database at ${dbPath}`);
