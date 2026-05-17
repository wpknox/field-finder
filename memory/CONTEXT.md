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

- **Phase**: PR #1 merged; PR #2 (`feature/geotiff-overlay`) fully working, ready to merge
- **Branch**: `feature/geotiff-overlay`
- **Worktree**: `.worktrees/feature-geotiff-overlay`
- **GitHub**: https://github.com/wpknox/field-finder

## What's Built (v1 + PR review polish + GeoTIFF branch)

Core v1 features (on `main`):

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

GeoTIFF overlay branch (PR #2 — fully working):

- Server skips `GetCDLImage`; downloads raw `.tif` binary, base64-encodes, sends via SSE `done` event
- **Hybrid render**: `georaster` parses the GeoTIFF → `georaster.toCanvas()` renders once using embedded CDL palette → `L.imageOverlay` places it with lat/lon bounds (smooth zoom, no per-tile re-render)
- `georaster-layer-for-leaflet` was abandoned — caused per-zoom lag and reprojection issues with CDL's projection code 32767
- Two-effect pattern in MapView: one tracks `tifBase64` (full re-parse), one tracks `overlayOpacity` (instant `setOpacity`, no re-parse)
- `untrack()` used to read `overlay` (for cleanup), `overlayOpacity` (initial value), and `center`/`radius` (search-time snapshot) without making them reactive dependencies
- `handedOffToMap` flag in `handleSearch` — prevents `finally` from clearing `loadingMessage` when MapView is still rendering
- OpacitySlider component; opacity persisted to localStorage
- AreaSummary component — collapsible, below Search button, only shown when stats present
- `computeCropStats` accepts `georaster.palette` for exact CDL colors; uses `CDL_LABELS` for all 130 CDL value names
- `CDL_LABELS: Record<number, string>` in `crops.ts` — complete 130-entry lookup for stats display
- CROPS filter colors updated to approximate official CDL hex values (to be verified against palette when API is available)
- `src/lib/projections.ts` — shared EPSG:5070 proj4 string, imported by both server (`coordinates.ts`) and client
- `src/lib/cropStats.ts` + full test suite (4 tests)

## Key Technical Facts

- CDL API calls **must be server-side** — CORS blocks browser-direct requests
- Server skips `GetCDLImage`, downloads raw `.tif` binary and base64-encodes it for SSE `done` event
- **SSE chunked buffering**: `+page.svelte` accumulates chunks in a `buffer` string, splits on `\n`, holds incomplete trailing lines — required because large base64 payloads span multiple chunks and `JSON.parse` fails on partial lines
- CDL GeoTIFFs embed EPSG:5070 as projection code **32767** (user-defined) — not a standard EPSG lookup
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
- `overlay` in MapView is `L.ImageOverlay` (not GridLayer) — placed with lat/lon bounds captured at search time via `untrack()`

## Active Work / What We're Doing Now

- PR #2 (`feature/geotiff-overlay`) is working end-to-end — ready to merge when CDL API comes back up for final verification
- CROPS filter colors are approximate CDL values; plan to verify exact hex against `georaster.palette` when API is available

## People / Roles

- Solo developer / project owner: wpknox
- No other collaborators at this time
