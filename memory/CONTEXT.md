---
id: context
type: memory
description: Living overview of project state — read this first at every session start
related:
  - memory/decisions.md
  - planning/features.md
  - CLAUDE.md
---

# Project Context

> This file is a living document. Update it as the project evolves.
> Keep it accurate and concise — it is the first thing read at the start of each session.

---

## What This Project Is

**field-finder** is a SvelteKit webapp that lets users explore USDA crop data overlaid on an interactive map. It replaces a clunky Python CLI (`../ff-py/ff.py`) with a real-time, browser-based experience. Primary use case: upland bird hunting scouting.

## Current State

- **Phase**: PR review complete — all feedback addressed, pushed, awaiting merge
- **Branch**: `feature/initial-webapp` — PR #1 open against `main`
- **Worktree**: `.worktrees/initial-webapp`
- **GitHub**: https://github.com/wpknox/field-finder

## What's Built (v1 + PR review polish)

Core v1 features:

- Collapsible left sidebar with animated slide (width transition + visibility)
- Address search (Nominatim geocoding, US-only results) + lat/lon coordinate input
- Lat/lon display below search bar, updated on every location change
- Interactive Leaflet map with click-to-set-location
- Map pans to follow marker when location is set via search (not on drag/click)
- Radius slider (1–50 mi, amber warning above 15)
- Year dropdown (1997–2024)
- Crop filter checkboxes with color swatches (localStorage persisted) + Select All / Clear All
- Hint when no crops selected ("all crop data will be shown")
- Explicit Search button (no auto-search)
- Real-time bounding box preview rectangle on map (live-updates while dragging marker)
- CDL PNG crop overlay (proxied through server as base64 to avoid CORS)
- SSE-streamed step-by-step progress messages during CDL fetch
- LoadingOverlay component — spinner + oscillating dots (1→2→3→1 at 500ms), replaces inline markup
- Collapsible color legend with smooth animation (CSS grid-rows trick)
- Legend and map hint co-located at bottom-left of map
- Location marker — draggable to reposition center
- Right-click waypoints (popup opens immediately, named, persisted to localStorage)
- Server-side CDL API proxy (EPSG:4326→5070 projection, XML parsing)
- Server-side Nominatim proxy with rate limiting
- ErrorToast component (dismissable, auto-dismisses after 5s)
- localStorage persistence for all user state
- Styled sidebar header (green-800) with outlined Hide/Expand buttons

## Key Technical Facts

- CDL API calls **must be server-side** — CORS blocks browser-direct requests
- **PNG is also proxied through the server** as a base64 data URL — NASS servers don't send CORS headers
- Input coordinates: EPSG:4326 → projected to EPSG:5070 (Albers) for CDL bbox via proj4
- CDL API is slow (seconds per request) — `/api/search` streams SSE progress events per step
- Nominatim: 1 req/sec rate limit, `User-Agent: FieldFinder/1.0`, restricted to `countrycodes=us`
- `GetCDLImage` returns `<returnURLArray>` (not `<returnURL>`) — regex handles both
- Svelte 5 runes used throughout: `$state`, `$effect`, `$derived`, `$props`, `$bindable`
- Leaflet loaded via dynamic import inside `onMount` (SSR safety)
- `mapReady = $state(false)` sentinel bridges async Leaflet init with `$effect` reactivity
- `waypointMarkers` and `waypointData` are plain `Map` (not `SvelteMap`) — intentional, UI reads from `waypoints` `$state` array
- Marker drag: `drag` event directly calls `bboxRect.setBounds` (bypasses Svelte state); `dragend` syncs `center`
- Map pan: `panVersion` counter prop on MapView, incremented only in `handleLocationSelect`

## Active Work / What We're Doing Now

- PR #1 pushed with all review fixes — wpknox reviewing manually on GitHub before merge
- No active in-progress tasks

## People / Roles

- Solo developer / project owner: wpknox
- No other collaborators at this time
