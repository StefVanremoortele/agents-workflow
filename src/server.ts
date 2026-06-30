import { createServer, type ServerResponse } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { URL } from "node:url";
import { HarnessStore } from "./store.js";
import type { HarnessEventInput } from "./types.js";

const port = Number(process.env.PORT ?? 4000);
const store = new HarnessStore();
const sseClients = new Set<ServerResponse>();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, { ok: true, service: "harness-server", version: "0.1.0" });
    }

    if (req.method === "POST" && url.pathname === "/events") {
      const body = await readJson(req);
      const validationError = validateEventInput(body);
      if (validationError) return json(res, { error: validationError }, 400);

      const { event, alerts, conclusion } = store.addEvent(body as HarnessEventInput);
      broadcast("event.created", event);
      if (conclusion) broadcast("conclusion.created", conclusion);
      for (const alert of alerts) broadcast("alert.created", alert);
      broadcast("agent.updated", store.getAgents().find((a) => a.id === event.source.id));
      broadcast("agents.updated", { agents: store.getAgents() });
      broadcast("tasks.updated", store.getTasks());
      broadcast("dashboard.updated", store.getDashboard());

      return json(res, { accepted: true, eventId: event.id, alertsCreated: alerts.length }, 202);
    }

    if (req.method === "GET" && url.pathname === "/dashboard") {
      return json(res, store.getDashboard());
    }

    if (req.method === "GET" && url.pathname === "/agents") {
      return json(res, { agents: store.getAgents() });
    }

    const agentMatch = url.pathname.match(/^\/agents\/([^/]+)$/);
    if (agentMatch && req.method === "PUT") {
      const body = await readJson(req);
      if (!body || typeof body !== "object" || typeof (body as Record<string, unknown>).name !== "string") {
        return json(res, { error: "name is required" }, 400);
      }
      const agent = store.renameAgent(decodeURIComponent(agentMatch[1]), (body as { name: string }).name);
      if (!agent) return json(res, { error: "Agent not found or name is empty" }, 404);
      broadcast("agent.updated", agent);
      broadcast("agents.updated", { agents: store.getAgents() });
      broadcast("tasks.updated", store.getTasks());
      broadcast("dashboard.updated", store.getDashboard());
      return json(res, { agent });
    }

    if (req.method === "GET" && url.pathname === "/events") {
      const limit = Number(url.searchParams.get("limit") ?? 100);
      return json(res, { events: store.getEvents(Number.isFinite(limit) ? limit : 100) });
    }

    if (req.method === "GET" && url.pathname === "/alerts") {
      return json(res, { alerts: store.getAlerts() });
    }

    if (req.method === "GET" && url.pathname === "/tasks") {
      return json(res, { tasks: store.getTasks() });
    }

    if (req.method === "GET" && url.pathname === "/conclusions") {
      return json(res, { conclusions: store.getConclusions() });
    }

    const ackMatch = url.pathname.match(/^\/alerts\/([^/]+)\/ack$/);
    if (req.method === "POST" && ackMatch) {
      const alert = store.acknowledgeAlert(ackMatch[1]);
      if (!alert) return json(res, { error: "Alert not found" }, 404);
      broadcast("alert.updated", alert);
      broadcast("dashboard.updated", store.getDashboard());
      return json(res, { acknowledged: true, alert });
    }

    if (req.method === "GET" && url.pathname === "/rules") {
      return json(res, { rules: store.getRules() });
    }

    if (req.method === "POST" && url.pathname === "/rules") {
      const body = await readJson(req);
      const validationError = validateRuleInput(body);
      if (validationError) return json(res, { error: validationError }, 400);
      const rule = store.addRule(body as Parameters<typeof store.addRule>[0]);
      broadcast("rule.updated", rule);
      return json(res, { rule }, 201);
    }

    const ruleMatch = url.pathname.match(/^\/rules\/([^/]+)$/);
    if (ruleMatch && req.method === "PUT") {
      const body = await readJson(req);
      const rule = store.updateRule(ruleMatch[1], body as Parameters<typeof store.updateRule>[1]);
      if (!rule) return json(res, { error: "Rule not found" }, 404);
      broadcast("rule.updated", rule);
      return json(res, { rule });
    }

    if (ruleMatch && req.method === "DELETE") {
      const deleted = store.deleteRule(ruleMatch[1]);
      if (!deleted) return json(res, { error: "Rule not found" }, 404);
      broadcast("rule.updated", { id: ruleMatch[1], deleted: true });
      return json(res, { deleted: true });
    }

    if (req.method === "GET" && url.pathname === "/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      return;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      return res.end();
    }

    return json(res, { error: "Not found" }, 404);
  } catch (error) {
    return json(res, { error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

await importOutbox();

server.listen(port, () => {
  console.log(`Harness server listening on http://localhost:${port}`);
});

async function importOutbox(): Promise<void> {
  const outboxPath = resolve(process.env.HARNESS_OUTBOX_PATH ?? ".harness/outbox.jsonl");
  let text = "";
  try {
    text = await readFile(outboxPath, "utf8");
  } catch {
    return;
  }

  const failedLines: string[] = [];
  let imported = 0;
  for (const line of text.split(/\n/)) {
    if (!line.trim()) continue;
    try {
      const input = JSON.parse(line) as unknown;
      const validationError = validateEventInput(input);
      if (validationError) throw new Error(validationError);
      store.addEvent(input as HarnessEventInput);
      imported += 1;
    } catch (error) {
      failedLines.push(line);
      console.warn(`Skipped outbox event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await mkdir(dirname(outboxPath), { recursive: true });
  if (failedLines.length > 0) {
    await writeFile(outboxPath, `${failedLines.join("\n")}\n`, "utf8");
  } else {
    await rename(outboxPath, `${outboxPath}.${Date.now()}.imported`).catch(async () => writeFile(outboxPath, "", "utf8"));
  }
  if (imported > 0) console.log(`Imported ${imported} harness outbox event(s) into the database.`);
}

function broadcast(eventName: string, data: unknown): void {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) client.write(frame);
}

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json", ...corsHeaders() });
  res.end(JSON.stringify(data, null, 2));
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

async function readJson(req: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateRuleInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return "Body must be an object";
  const value = input as Record<string, any>;
  if (typeof value.name !== "string" || value.name.length === 0) return "name is required";
  if (typeof value.enabled !== "boolean") return "enabled boolean is required";
  if (!value.match || typeof value.match !== "object") return "match is required";
  if (!value.alert || typeof value.alert !== "object") return "alert is required";
  if (typeof value.match.field !== "string") return "match.field is required";
  if (typeof value.match.operator !== "string") return "match.operator is required";
  if (typeof value.match.value !== "string") return "match.value is required";
  if (typeof value.alert.severity !== "string") return "alert.severity is required";
  if (typeof value.alert.title !== "string") return "alert.title is required";
  return undefined;
}

function validateEventInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return "Body must be an object";
  const value = input as Record<string, unknown>;
  if (value.schemaVersion !== "1") return "schemaVersion must be '1'";
  if (!value.source || typeof value.source !== "object") return "source is required";
  if (!value.event || typeof value.event !== "object") return "event is required";

  const source = value.source as Record<string, unknown>;
  const event = value.event as Record<string, unknown>;
  if (typeof source.id !== "string" || source.id.length === 0) return "source.id is required";
  if (typeof source.type !== "string" || source.type.length === 0) return "source.type is required";
  if (typeof event.type !== "string" || event.type.length === 0) return "event.type is required";
  return undefined;
}
