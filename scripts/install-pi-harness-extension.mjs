#!/usr/bin/env node
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const sourceExtension = resolve(repoRoot, ".pi/extensions/harness-reporter.ts");
const targetExtension = resolve(homedir(), ".pi/agent/extensions/harness-reporter.ts");
const globalConfigPath = resolve(homedir(), ".pi/agent/harness-reporter.json");

const args = process.argv.slice(2);
const options = parseArgs(args);

await mkdir(dirname(targetExtension), { recursive: true });
await copyFile(sourceExtension, targetExtension);

if (options.serverUrl || options.sourceName) {
  const config = {
    ...(options.serverUrl ? { serverUrl: options.serverUrl } : {}),
    ...(options.sourceName ? { sourceName: options.sourceName } : {}),
    updatedAt: new Date().toISOString(),
  };
  await writeFile(globalConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

console.log(`Installed Pi harness reporter extension to ${targetExtension}`);
if (options.serverUrl || options.sourceName) {
  console.log(`Wrote global config to ${globalConfigPath}`);
}
console.log("Restart pi, or run /reload in an active pi session, to load the global extension.");
console.log("Start the harness server with: npm run dev:server");

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (arg === "--server-url") {
      parsed.serverUrl = requireValue(arg, values[++index]);
    } else if (arg === "--source-name") {
      parsed.sourceName = requireValue(arg, values[++index]);
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }
  return parsed;
}

function requireValue(flag, value) {
  if (!value || value.startsWith("--")) {
    console.error(`${flag} requires a value`);
    process.exit(1);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: node scripts/install-pi-harness-extension.mjs [options]\n\nOptions:\n  --server-url <url>    Harness server URL, default http://localhost:4000\n  --source-name <name>  Default display name, default "Pi Agent"\n`);
}
