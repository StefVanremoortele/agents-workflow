import { create } from "zustand";
import { emptyDashboard, globalHistLength, histLength } from "@/config";
import { loadFleet, renameAgent as apiRenameAgent } from "@/api/client";
import { cacheSnapshot, readCachedSnapshot } from "@/lib/cache";
import { sortAgents } from "@/lib/derive";
import { normalizeActivity, pushHistory, seedHistory } from "@/lib/history";
import type {
  AgentRecord,
  AgentTaskRecord,
  ConclusionRecord,
  DashboardSnapshot,
  DashboardSummary,
  FilterMode,
  HarnessEventRecord,
  ViewMode,
} from "@/types/view";

type ServerStatus = "connecting" | "online" | "offline";
type DetailNav = { from: string; parity: number };

// Non-reactive bookkeeping for activity-delta sparklines (was a useRef).
const previousEventCounts: Record<string, number> = {};

type FleetStore = {
  // Server state
  dashboard: DashboardSummary;
  agents: AgentRecord[];
  tasks: AgentTaskRecord[];
  events: HarnessEventRecord[];
  conclusions: ConclusionRecord[];
  agentHistories: Record<string, number[]>;
  eventTicks: number[];

  // UI state
  view: ViewMode;
  filter: Exclude<FilterMode, "offline">;
  showOffline: boolean;
  live: boolean;
  clock: string;
  serverStatus: ServerStatus;
  selectedAgentId?: string;
  detailNav: DetailNav;

  // Server-data actions
  applySnapshot: (snapshot: DashboardSnapshot) => void;
  setDashboard: (dashboard: DashboardSummary) => void;
  setAgents: (agents: AgentRecord[]) => void;
  upsertAgent: (agent: AgentRecord) => void;
  setTasks: (tasks: AgentTaskRecord[]) => void;
  prependEvent: (event: HarnessEventRecord) => void;
  addConclusion: (conclusion: ConclusionRecord) => void;
  updateHistories: (agents: AgentRecord[]) => void;
  pushEventTick: (delta: number) => void;
  setServerStatus: (status: ServerStatus) => void;

  // Orchestration
  refresh: () => Promise<void>;
  hydrateFromCache: () => void;
  renameAgent: (id: string, name: string) => Promise<void>;

  // UI actions
  setView: (view: ViewMode) => void;
  setFilter: (filter: Exclude<FilterMode, "offline">) => void;
  toggleOffline: () => void;
  toggleLive: () => void;
  tickClock: (clock: string) => void;
  openAgent: (id: string) => void;
  closeAgent: () => void;
  navigateAgent: (delta: -1 | 1) => void;
};

export const useFleetStore = create<FleetStore>((set, get) => ({
  dashboard: emptyDashboard,
  agents: [],
  tasks: [],
  events: [],
  conclusions: [],
  agentHistories: {},
  eventTicks: [],

  view: "cards",
  filter: "all",
  showOffline: false,
  live: true,
  clock: new Date().toLocaleTimeString("en-GB"),
  serverStatus: "connecting",
  selectedAgentId: undefined,
  detailNav: { from: "0px", parity: 0 },

  applySnapshot: (snapshot) => set({ dashboard: snapshot.dashboard, agents: snapshot.agents, tasks: snapshot.tasks }),
  setDashboard: (dashboard) => set({ dashboard, serverStatus: "online" }),
  setAgents: (agents) => {
    set({ agents, serverStatus: "online" });
    get().updateHistories(agents);
  },
  upsertAgent: (agent) => {
    set((state) => ({
      agents: [agent, ...state.agents.filter((item) => item.id !== agent.id)].sort(sortAgents),
      serverStatus: "online",
    }));
    get().updateHistories([agent]);
  },
  setTasks: (tasks) => set({ tasks, serverStatus: "online" }),
  prependEvent: (event) => {
    set((state) => ({
      events: [event, ...state.events.filter((item) => item.id !== event.id)].slice(0, 200),
      serverStatus: "online",
    }));
    get().pushEventTick(1);
  },
  addConclusion: (conclusion) =>
    set((state) => ({
      conclusions: [conclusion, ...state.conclusions.filter((item) => item.id !== conclusion.id)].slice(0, 200),
      serverStatus: "online",
    })),

  updateHistories: (nextAgents) =>
    set((state) => {
      const updated = { ...state.agentHistories };
      for (const agent of nextAgents) {
        const previousCount = previousEventCounts[agent.id] ?? agent.stats.eventCount;
        const delta = Math.max(0, agent.stats.eventCount - previousCount);
        previousEventCounts[agent.id] = agent.stats.eventCount;
        const sample = agent.status === "offline" ? 0 : Math.max(normalizeActivity(agent.stats.eventCount), Math.min(1, delta / 12));
        updated[agent.id] = pushHistory(updated[agent.id] ?? seedHistory(agent.id, sample), sample, histLength);
      }
      return { agentHistories: updated };
    }),

  pushEventTick: (delta) => {
    if (!get().live) return;
    set((state) => ({ eventTicks: [...state.eventTicks.slice(-(globalHistLength - 1)), delta] }));
  },

  setServerStatus: (serverStatus) => set({ serverStatus }),

  refresh: async () => {
    try {
      const { snapshot, events, conclusions } = await loadFleet();
      get().applySnapshot(snapshot);
      set({ events, conclusions, serverStatus: "online" });
      cacheSnapshot(snapshot);
      get().updateHistories(snapshot.agents);
    } catch {
      set({ serverStatus: "offline" });
    }
  },

  hydrateFromCache: () => {
    const cached = readCachedSnapshot();
    if (cached) get().applySnapshot(cached);
  },

  renameAgent: async (id, name) => {
    await apiRenameAgent(id, name);
    await get().refresh();
  },

  setView: (view) => set({ view }),
  setFilter: (filter) => set({ filter }),
  toggleOffline: () => set((state) => ({ showOffline: !state.showOffline })),
  toggleLive: () => set((state) => ({ live: !state.live })),
  tickClock: (clock) => set({ clock }),

  openAgent: (id) => set((state) => ({ selectedAgentId: id, detailNav: { from: "0px", parity: state.detailNav.parity ^ 1 } })),
  closeAgent: () => set({ selectedAgentId: undefined }),
  navigateAgent: (delta) => {
    const { agents, selectedAgentId, detailNav } = get();
    if (agents.length === 0) return;
    const currentIndex = selectedAgentId ? agents.findIndex((agent) => agent.id === selectedAgentId) : -1;
    const cursor = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (cursor + delta + agents.length) % agents.length;
    set({
      selectedAgentId: agents[nextIndex].id,
      detailNav: { from: delta > 0 ? "38px" : "-38px", parity: detailNav.parity ^ 1 },
    });
  },
}));
