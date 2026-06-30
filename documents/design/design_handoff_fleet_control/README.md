# Handoff: Fleet Control — AI Agent Fleet Overview

## Overview
A real-time dashboard that shows a fleet of AI agents and **what each one is doing right now**:
its current task, progress, elapsed time / ETA, live activity throughput, and status
(working / waiting on input / idle / offline). It replaces an older dark "Command Center"
dashboard. Two views: rich **Cards** and a dense **Table**, with state filters and a live
throughput readout.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing
intended look and behavior. They are **not production code to copy directly**. The `.dc.html`
file uses a small in-house runtime to render and will not run standalone; use it to read the
markup/logic, and use `Fleet Control (reference, openable).html` (a self-contained build) to
**open in a browser and see the live, animated design**.

Your task is to **recreate this design in this repository's existing environment** (React/Vue/
Svelte/etc.) using its established components, styling approach, and data layer. The live data here
is mocked with a 1-second timer; wire it to your real agent telemetry / SSE stream instead.

## Screenshots
- `screenshots/cards-view-top.png` — Cards view, top of grid (status pills, waiting card with coral glow + RESPOND, "CURRENT TASK").
- `screenshots/cards-view.png` — Cards view, showing working progress bars, ETA/elapsed, and per-agent activity sparklines.
- `screenshots/table-view.png` — Dense table view (Agent · Status · Current task · Progress · Elapsed · ETA · Activity · Events).
- For the live, animated version, open `Fleet Control (reference, openable).html`.

> Note: status/progress values differ between screenshots because the data updates live every second.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, states, and interactions are all
specified below. Recreate the UI to match, then swap mock data for live data.

---

## Layout (single screen)

Centered column, `max-width: 1320px`, page padding `30px 30px 70px`. Background is warm near-black
with two soft radial glows (top-right amber, top-left red). Vertical stack:

1. **Header row** (space-between, align-end, wraps)
   - Left: kicker → H1 → subtitle.
   - Right: a **Throughput panel** (events/min + global sparkline) above a row with a clock and a Live/Pause toggle.
2. **KPI strip** — 5 equal flex tiles (`min-width:150px`), gap 12px, wraps.
3. **Controls row** (space-between): left = "Live Fleet" + agent count; right = Cards/Table segmented toggle + Refresh.
4. **Filter chips** — All / Working / Waiting / Idle / Offline, each with a count.
5. **Content** — Cards grid **or** Table, depending on the toggle.

### Cards view
CSS grid, `repeat(auto-fill, minmax(300px, 1fr))`, gap 16px (compact: minmax 252px, gap 10px).
Each card (see "Agent card" component) fades up on mount with a staggered `animation-delay` of
`index * 0.04s`.

### Table view
Single bordered, rounded (16px) container, `overflow:hidden`, background `--panel`.
Header row + body rows are **CSS grid**, not `<table>`, with identical columns:
`190px 160px minmax(200px,1fr) 140px 82px 82px 120px 84px`
→ Agent · Status · Current task · Progress · Elapsed · ETA · Activity · Events (right-aligned).
Row padding `14px 18px`, 1px bottom divider, hover background `rgba(255,255,255,0.03)`.

---

## Components

### Header
- **Kicker**: "AGENT FLEET · LIVE OBSERVABILITY" — JetBrains Mono 600, 11px, letter-spacing 0.22em, uppercase, color `--accent`.
- **H1**: "Fleet Control" — Space Grotesk 700, 46px, letter-spacing -0.025em, line-height 0.98.
- **Subtitle**: "Real-time view of every agent and exactly what it is working on right now." — 15px, color `--muted`, max-width 460px.

### Throughput panel
- Card: 1px `--line` border, radius 15px, `linear-gradient(180deg, --panel2, --panel)`, padding `14px 18px`, flex row gap 16px.
- Label "THROUGHPUT" (mono 10px, letter-spacing 0.14em, `--faint`).
- Value: big number (mono 700, 30px, `--accent`) + "events / min" (12px, `--muted`).
- **Global sparkline**: `<svg viewBox="0 0 160 40" preserveAspectRatio="none">` with a filled area
  (`color-mix(in oklch, var(--accent) 16%, transparent)`) and a 1.8px `--accent` polyline.
- Below the card: clock (mono 12px, `--faint`, `toLocaleTimeString('en-GB')`) + Live/Pause pill.

### Live / Pause pill
Pill button, 1px `--line2` border, transparent bg. Dot (7px) + label.
- Live: dot `#46d98a` pulsing (`fpulse 1.6s ease-in-out infinite`), label "LIVE" color `#86e3ad`.
- Paused: dot `--faint` static, label "PAUSED" color `--muted`.
Clicking toggles whether the live timer advances state.

### KPI tile
Border 1px `--line`, radius 14px, gradient bg, padding `16px 18px`.
- Label: mono 600, 10px, letter-spacing 0.12em, uppercase, `--faint`.
- Value: mono 600, 30px, letter-spacing -0.02em.
Five tiles, in order, with value colors:
1. **Working** — count of working agents — color `--working`.
2. **Waiting on input** — count — color `--waiting`.
3. **Idle / offline** — idle + offline count — color `--muted`.
4. **Avg progress** — mean progress of working agents, e.g. "47%" — color `--txt`.
5. **Fleet size** — total agents — color `--txt`.

### Segmented view toggle
Inline-flex container, padding 4px, 1px `--line2` border, radius 99px, bg `--panel`.
Two buttons "Cards" / "Table" (mono 600, 11px, letter-spacing 0.06em, uppercase, padding `7px 15px`, radius 99px).
Selected button: bg `--accent`, text `#1a130b`. Unselected: transparent bg, text `--muted`.

### Refresh button
Pill, 1px `--line2`, transparent, mono 600 11px uppercase, padding `9px 15px`, color `--muted`.
In the prototype it manually advances one tick; in production, re-fetch fleet state.

### Filter chip
Pill, padding `8px 14px`, radius 99px, mono 600 11px, letter-spacing 0.06em, uppercase, inline-flex gap 7px.
Label + count (count at 0.65 opacity). Active chip: bg `--accent`, text `#1a130b`, border `--accent`.
Inactive: transparent bg, text `--muted`, border `--line2`. Clicking filters the list by that state
(`all` shows everything).

### Agent card
Container: position relative, `overflow:hidden`, 1px `--line` border, radius 16px,
padding `--cardpad` (18px / compact 13px), gradient bg, box-shadow varies by state (see below).
Hover: `translateY(-3px)`, border `--line2`. Idle/offline cards render at `opacity: 0.72`.

Internal structure (top → bottom):
1. **Header line**: status dot (9px, bg = state color, `box-shadow: 0 0 11px <color>`, pulsing for working/waiting) · agent name (Space Grotesk 600, 16px, -0.01em) · spacer · **status pill**.
2. **Sub-line**: "`<model> · <project>`" — mono 500, 11.5px, `--faint` (e.g. "Claude Opus · payments-api").
3. **Current task block**: label "CURRENT TASK" (mono 600, 10px, 0.13em, `--accent`, uppercase) → task text (14.5px, line-height 1.35, clamped to 2 lines, min-height 39px).
4. **State-specific row** (one of):
   - *Working* → progress: a row with step label ("Step 6 / 11", mono 600 11px `--muted`) and percent (right, `--txt`), then a 6px track (`rgba(255,255,255,0.06)`, radius 99px) with a fill of width = progress%, `background: linear-gradient(90deg, color-mix(in oklch, var(--working) 65%, #fff), var(--working))`, `transition: width .6s ease`.
   - *Waiting* → a banner: bg `color-mix(in oklch, var(--waiting) 12%, transparent)`, 1px `color-mix(...26%...)` border, radius 11px, padding `10px 12px`; text "Paused · needs your input" (mono 600 12px `--waiting`) + a **RESPOND** button (mono 600 11px, text `#1a130b`, bg `--waiting`, radius 9px, padding `7px 13px`).
   - *Idle/offline* → no extra row.
5. **Meta row**: two stacked stats, gap 24px — **Elapsed** and **ETA**. Label mono 600 10px 0.1em `--faint` uppercase; value mono 600 14px `--txt`.
6. **Activity footer**: 1px top divider `--line`, padding-top 13px. Row: "ACTIVITY" (mono 10px `--faint`) + "`<n>` events" (mono 600 11px `--muted`). Below: full-width sparkline `<svg viewBox="0 0 260 40" preserveAspectRatio="none">` — filled area `color-mix(in oklch, var(<stateColor>) 15%, transparent)` + 1.8px polyline stroked with the state color.

Card box-shadow:
- Waiting: `0 0 0 1px color-mix(in oklch, var(--waiting) 36%, transparent), 0 18px 44px -24px color-mix(in oklch, var(--waiting) 65%, transparent)` (a coral glow ring).
- Other: `0 16px 36px -28px rgba(0,0,0,0.85)`.

### Status pill (cards & table)
Inline-flex, gap 6px, mono 600, uppercase. Cards: 10px / letter-spacing 0.07em / padding `5px 10px`.
Table: 9.5px / 0.06em / padding `5px 9px`. For every state:
`color: var(<stateColor>); background: color-mix(in oklch, var(<stateColor>) 14%, transparent);
border: 1px solid color-mix(in oklch, var(<stateColor>) 30%, transparent)`.
Labels: Working / Waiting on input / Idle / Offline.

### Table sparkline
Small `<svg viewBox="0 0 96 26" preserveAspectRatio="none">`, 1.6px polyline, same color logic.

---

## Interactions & Behavior
- **Live timer** (1s interval): when "Live", each tick advances state (see State Management). Pausing freezes it; the clock keeps updating.
- **View toggle**: switches Cards ⇄ Table (client state, instant).
- **Filters**: filter the rendered list by status; counts always reflect the full fleet.
- **Refresh**: prototype runs one extra tick; production should re-fetch.
- **RESPOND** (waiting cards): placeholder — should open the agent's input/approval flow.
- **Hover**: cards lift + border brightens; table rows get a subtle background.
- **Mount animation**: cards fade/slide up (`fadeup .5s`), staggered by index.
- **Pulse**: working & waiting status dots (and the live dot) pulse via `@keyframes fpulse { 0%,100%{opacity:1} 50%{opacity:.4} }` at 1.6s.

## State Management
Prototype state (replace with your store + live data):
- `view`: 'cards' | 'table'
- `filter`: 'all' | 'working' | 'waiting' | 'idle' | 'offline'
- `live`: boolean (timer on/off)
- `agents[]`: each `{ name, model, project, state, task, step, total, progress, eta, elapsed, events, hist[] }`
  - `hist` is a ring buffer (length 28) of normalized 0–1 activity values that feeds the sparkline.
- `gspark[]`: global throughput ring buffer (length 48) for the header sparkline.
- `epm`: events/min (sum of this tick's per-agent event increments).
- `clock`: formatted time string.

Mock transitions per tick (for realism — your real data replaces these):
- *working*: elapsed++, eta−−, ~18% chance step++, events += 4–14, push high activity sample. On step ≥ total → become **idle**; ~1% chance → **waiting**.
- *waiting*: elapsed++, small/no events, low activity sample; ~1.5% chance resume **working**.
- *idle*: ~4% chance pick a new task and start **working**.
- *offline*: inert (zero activity).

In production: drive `agents`, `epm`, and the sparkline buffers from your SSE/event stream; keep
`view`/`filter`/`live` as local UI state.

## Design Tokens
Defined as CSS custom properties on the root; the `accent`/`working` pair is themeable (see Variants).

Colors:
- `--bg`: `#15110c` (page) + radial glows `rgba(255,140,50,0.11)` (top-right), `rgba(255,86,60,0.07)` (top-left)
- `--panel`: `#1d1812`  ·  `--panel2`: `#241d15` (cards use `linear-gradient(180deg, --panel2, --panel)`)
- `--line`: `rgba(255,184,104,0.09)`  ·  `--line2`: `rgba(255,184,104,0.17)`
- `--txt`: `#f3ebdb`  ·  `--muted`: `#a99c84`  ·  `--faint`: `#6f6451`
- `--accent` / `--working`: `#ff9e42` (amber, default theme)
- `--waiting`: `#ff6a5c` (coral)  ·  `--idle`: `#a7977b`  ·  `--offline`: `#5f5746`
- On-accent text (selected pills/buttons): `#1a130b`
- Live dot: `#46d98a`; live label: `#86e3ad`
- Track bg: `rgba(255,255,255,0.06)`; row hover: `rgba(255,255,255,0.03)`

State color → token map: working→`--working`, waiting→`--waiting`, idle→`--idle`, offline→`--offline`.
Soft fills use `color-mix(in oklch, var(<token>) <pct>%, transparent)`.

Radius: pills/dots 99px · cards 16px · KPI/throughput 14–15px · banner 11px · button 9px · track 6px (5px in table).
Spacing scale used: 4 / 6 / 7 / 8 / 10 / 12 / 13 / 14 / 15 / 16 / 18 / 24 / 26 / 30 px.
Shadows: card default `0 16px 36px -28px rgba(0,0,0,0.85)`; waiting glow (above).
Transitions: progress width `.6s ease`; mount `fadeup .5s`; pulse `fpulse 1.6s ease-in-out infinite`.

Typography:
- Display/UI: **Space Grotesk** (400–700). H1 46/700, H2 21/600, names 16/600, body 14.5–15.
- Data/labels: **JetBrains Mono** (400–700). Numbers, kickers, status pills, step/percent, clock.
- Both via Google Fonts. If your codebase has equivalent display + mono fonts, prefer those.

## Variants / Tweaks (optional, exposed in the prototype)
- **accent**: `amber` (`#ff9e42`, default) · `ember` (`#ff7a39`) · `copper` (`#e88f54`). Sets both `--accent` and `--working`.
- **density**: `comfortable` (default) · `compact` → grid min-col 252px, card padding 13px, gap 10px.

## Sample data (the 11 seeded agents)
Atlas (Opus, payments-api, working, "Refactor settlement reconciliation logic", 6/11) ·
Beacon (Sonnet, web-dashboard, working, 3/8) ·
Cipher (Opus, auth-service, **waiting**, "Approve rotation of production secrets") ·
Dynamo (Sonnet, data-pipeline, working, 9/14) ·
Echo (Haiku, mobile-app, **waiting**, "Pick a navigation library") ·
Forge (Sonnet, infra-terraform, working, 2/6) ·
Gale (Haiku, search-index, **idle**) ·
Halo (Opus, billing, working, 11/12) ·
Iris (Opus, ml-platform, working, 5/20) ·
Juno (Haiku, docs-site, **offline**) ·
Kilo (Sonnet, qa-suite, **waiting**, "Review 3 failing end-to-end tests").

## Assets
None. No images or icon fonts — all visuals are CSS + inline SVG sparklines. Only external
dependency is the two Google Fonts.

## Files in this bundle
- `Fleet Control (reference, openable).html` — self-contained build; **open in a browser** to see the live design.
- `Fleet Control.dc.html` — source prototype (markup + logic) for reading exact values; needs the in-house runtime to render, so don't try to run it standalone.
- `screenshots/` — cards-view-top.png, cards-view.png, table-view.png.
- `README.md` — this spec (self-sufficient; implement from this alone).
