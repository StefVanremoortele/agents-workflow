import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AgentRecord, AgentTaskRecord, AlertRecord, ConclusionRecord, HarnessEvent, TriggerRule } from "./types.js";

export class HarnessDatabase {
  private db: Database.Database;

  constructor(path = process.env.HARNESS_DB_PATH ?? ".harness/harness.db") {
    const dbPath = resolve(path);
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  getEvents(): HarnessEvent[] {
    return this.db.prepare("SELECT json FROM events ORDER BY timestamp DESC, id DESC").all().map(rowJson<HarnessEvent>);
  }

  saveEvent(event: HarnessEvent): void {
    this.db.prepare(`
      INSERT INTO events (id, timestamp, source_id, type, severity, json)
      VALUES (@id, @timestamp, @sourceId, @type, @severity, @json)
      ON CONFLICT(id) DO UPDATE SET
        timestamp = excluded.timestamp,
        source_id = excluded.source_id,
        type = excluded.type,
        severity = excluded.severity,
        json = excluded.json
    `).run({
      id: event.id,
      timestamp: event.timestamp,
      sourceId: event.source.id,
      type: event.event.type,
      severity: event.event.severity,
      json: JSON.stringify(event),
    });
  }

  getAgents(): AgentRecord[] {
    return this.getJsonTable<AgentRecord>("agents", "updated_at DESC, id DESC");
  }

  saveAgent(agent: AgentRecord): void {
    this.saveJsonTable("agents", agent.id, agent, agent.timestamps.firstSeenAt, agent.timestamps.lastSeenAt);
  }

  getTasks(): AgentTaskRecord[] {
    return this.getJsonTable<AgentTaskRecord>("tasks", "updated_at DESC, id DESC");
  }

  saveTask(task: AgentTaskRecord): void {
    this.saveJsonTable("tasks", task.id, task, task.startedAt, task.updatedAt);
  }

  getAlerts(): AlertRecord[] {
    return this.getJsonTable<AlertRecord>("alerts", "created_at DESC, id DESC");
  }

  saveAlert(alert: AlertRecord): void {
    this.saveJsonTable("alerts", alert.id, alert, alert.createdAt, alert.createdAt);
  }

  getConclusions(): ConclusionRecord[] {
    return this.getJsonTable<ConclusionRecord>("conclusions", "created_at DESC, id DESC");
  }

  saveConclusion(conclusion: ConclusionRecord): void {
    this.saveJsonTable("conclusions", conclusion.id, conclusion, conclusion.createdAt, conclusion.createdAt);
  }

  getRules(): TriggerRule[] {
    return this.getJsonTable<TriggerRule>("rules", "created_at ASC, id ASC");
  }

  saveRule(rule: TriggerRule): void {
    this.saveJsonTable("rules", rule.id, rule, new Date().toISOString(), new Date().toISOString());
  }

  deleteRule(id: string): boolean {
    return this.db.prepare("DELETE FROM rules WHERE id = ?").run(id).changes > 0;
  }

  transaction<T>(callback: () => T): T {
    return this.db.transaction(callback)();
  }

  private getJsonTable<T>(table: string, orderBy: string): T[] {
    return this.db.prepare(`SELECT json FROM ${table} ORDER BY ${orderBy}`).all().map(rowJson<T>);
  }

  private saveJsonTable(table: string, id: string, value: unknown, createdAt: string, updatedAt: string): void {
    this.db.prepare(`
      INSERT INTO ${table} (id, json, created_at, updated_at)
      VALUES (@id, @json, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        json = excluded.json,
        updated_at = excluded.updated_at
    `).run({ id, json: JSON.stringify(value), createdAt, updatedAt });
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        source_id TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT,
        json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_events_source ON events(source_id);

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agents_updated ON agents(updated_at DESC);

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at DESC);

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);

      CREATE TABLE IF NOT EXISTS conclusions (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conclusions_created ON conclusions(created_at DESC);

      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }
}

function rowJson<T>(row: unknown): T {
  return JSON.parse((row as { json: string }).json) as T;
}
