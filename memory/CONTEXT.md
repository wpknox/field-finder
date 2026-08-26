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

- **Phase**: PR #1 and PR #2 merged. **PR #3 open** (https://github.com/wpknox/field-finder/pull/3) — audit tranche 1 correctness fixes, awaiting review/merge.
- **Branch**: `fix/audit-tranche-1` (8 commits ahead of `main`, pushed)
- **Worktree**: none — tranche 1 was executed in the primary directory, not a worktree, because the plan needed a dev server plus live browser verification
- **GitHub**: https://github.com/wpknox/field-finder

## What's Built (all on `main`)

Core v1 features (on `main`):

- Collapsible left sidebar with animated slide (width transition + visibility)
- Address search (Nominatim geocoding, US-only results) + lat/lon coordinate input
- Lat/lon display below search bar, updated on every location change
- Interactive Leaflet map with click-to-set-location
- Map pans to follow marker when location is set via search (not on drag/click)
- Radius slider (1–50 mi, amber warning above 15)
- Year dropdown (1997–2024) — range lives in `src/lib/constants.ts` (`CDL_MIN_YEAR`/`CDL_MAX_YEAR`/`CDL_YEARS`)
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

GeoTIFF overlay (PR #2 — merged to `main` 2026-08-26):

- Server skips `GetCDLImage`; downloads raw `.tif` binary, base64-encodes, sends via SSE `done` event
- **Custom palette renderer**: `georaster` parses the GeoTIFF → `src/lib/renderGeoraster.ts`'s `rasterToDataUrl()` paints the raster to a canvas at native resolution, mapping each pixel through the embedded `georaster.palette` (noData transparent) → `L.imageOverlay` places the resulting PNG data URL with lat/lon bounds (smooth zoom, no per-tile re-render). `georaster.toCanvas()` was abandoned (see below).
- `georaster-layer-for-leaflet` was abandoned earlier — caused per-zoom lag and reprojection issues with CDL's projection code 32767
- `georaster.toCanvas()` was abandoned after that — confirmed live on 2026-08-23 that it caps output at 100×100 and renders single-band rasters as min/max-scaled grayscale, never reading `georaster.palette`. It never actually worked; the prior "fully working" status in this file was written while the CDL API was down and unverified.
- **Live verification (2026-08-23, Playwright, radius 10mi, year 2024, test location 40.553950/-100.076157)**: overlay image is 1114×1128 (native `georaster.width/height`, not 100×100); pixel-decoded the data URL and found 30 distinct colors, all real CDL palette entries; pixel ratios (Grassland/Pasture 59.3%, Corn 24.5%, Soybeans 5.3%, Winter Wheat 2.7%) match the Area Summary percentages exactly; screenshot shows crisp center-pivot circles and rectangular fields in correct crop colors; opacity slider updates the same `<img>` instantly with no re-parse; zero application console errors.
- Two-effect pattern in MapView: one tracks `searchResult` (full re-parse), one tracks `overlayOpacity` (instant `setOpacity`, no re-parse)
- `untrack()` used to read `overlay` (for cleanup) and `overlayOpacity` (initial value) without making them reactive dependencies. It is **no longer** used for `center`/`radius` in the overlay effect — that was audit B2 (it captured render-time, not search-time, values); the snapshot now arrives in the `searchResult` prop.
- `handedOffToMap` flag in `handleSearch` — prevents `finally` from clearing `loadingMessage` when MapView is still rendering
- OpacitySlider component; opacity persisted to localStorage
- AreaSummary component — collapsible, below Search button, only shown when stats present
- `computeCropStats` accepts `georaster.palette` for exact CDL colors; uses `CDL_LABELS` for all 130 CDL value names
- `CDL_LABELS: Record<number, string>` in `crops.ts` — complete 130-entry lookup for stats display
- CROPS filter/legend colors verified against the real raster palette (`7778cb6`) and now resolved from the live `georaster.palette` at runtime via `resolveCropColors()` (`9cef53f`); hardcoded hexes remain as the pre-search fallback
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
- Map pan: `panVersion` counter prop on MapView, incremented only in `handleLocationSelect`. The pan `$effect` reads `center` via `untrack()` so `panVersion` is its **only** reactive dependency — a tracked read was audit B1 (map re-panned on every click and drag).
- `overlay` in MapView is `L.ImageOverlay` (not GridLayer) — placed with lat/lon bounds from `searchResult.{lat,lon,radius}`, snapshotted in `handleSearch` **before** the request is sent
- **`searchResult` snapshot pattern** (`src/lib/searchResult.ts`): every completed search yields a _new_ `{tifBase64, lat, lon, radius}` object. MapView has two non-interchangeable sources of position — live `center`/`radius` drive the marker and bbox preview; the frozen snapshot drives the overlay. Never mix them.
- **CDL fetch timeouts**: `CDL_TIMEOUT_MS = 60_000` in `src/lib/server/cdl.ts`; metadata calls get 60s, the raster download gets 2×. A timeout throws `CdlTimeoutError` and surfaces as "USDA CDL service is not responding — try again later" rather than an endless spinner.

## Active Work / What We're Doing Now

- **PR #3 open — audit tranche 1.** Fixes C1, B1, B2, B3, B4, B5 from `planning/audit-2026-08-26.md`, executed per `planning/plans/2026-08-26-audit-tranche-1.md`. Suite is **55/55**, `svelte-check` 0 errors on 665 files, lint passes, and `npm run build` succeeds (first build ever run on this codebase).
- **⚠️ Two things need a human once the CDL service recovers:**
  1. **B2 and B3 were never observed working.** Both need a successful CDL round-trip; they typecheck and passed spec + quality review but are unverified live. Repro: search 40.553950/-100.076157 at 10 mi, drag the marker mid-fetch (overlay must stay on the _original_ bbox), then run the identical search twice (the second must clear the loading overlay).
  2. **`CDL_MAX_YEAR` is still 2024.** Whether the 2025 layer exists is unconfirmed — every probe hung. Bumping it is now one line in `src/lib/constants.ts`.
- **CDL service is hanging as of 2026-08-26** — not merely slow. A direct probe returns `status=000 size=0 time=40.001s` while the host answers (CropScape returns 302). This is the documented "CDL API intermittently down" blocker, and it is exactly what B5's timeouts now handle gracefully.
- **Audit is the work queue.** `planning/audit-2026-08-26.md` — tranche 1 items are marked `[FIXED …]` inline. Remaining: B6, B7, C2–C7, D1–D5, plus a new **section F** of findings raised by the tranche 1 code reviews (orphaned-overlay race, `SearchResult` missing year/crops, unvalidated SSE payload, split `loadingMessage` ownership). Per the audit, do **not** start year comparison before F1/F2 are considered — that feature doubles the overlay plumbing.
- **Known limitation (still true)**: the overlay paints an EPSG:5070 (Albers) raster onto a Mercator map via `imageOverlay`, causing minor placement skew. Per-pixel Albers→Mercator warping is unimplemented. Verification showed placement is acceptable in practice, but this is not "fixed."
- **Resolved 2026-08-23 (commit `dbf4bcf`)**: at runtime `georaster.noDataValue` is `null` and `palette[0]` is opaque black (`[0,0,0,255]`), so the `?? 0` coalesce is load-bearing — without it value-0 background pixels paint as opaque black specks. The renderer coalesced but `computeCropStats` received the raw `null` and counted those pixels, producing a bogus `Unknown (ID: 0) — 0.2%` row in Area Summary. Fixed by hoisting one `const noData = georaster.noDataValue ?? 0` and passing it to both call sites. Verified live: the bogus row is gone and percentages still renormalize correctly (`computeCropStats` skips before incrementing `total`).
- **Resolved 2026-08-23 (commit `7778cb6`)**: all 13 CROPS filter colors verified against the real `georaster.palette` from a live CDL raster — **12 of 13 were wrong** (only Sorghum was correct). Barley was brown rather than magenta, Oats periwinkle rather than purple; corrected values now match the semantic legend in `CLAUDE.md`. Corn is `#FFD200`, not the `#FFD300` CropScape publishes — confirmed from the raw TIFF `ColorMap` tag (green channel `53970` = `210 × 257`, a lossless 16→8-bit conversion), and the overlay renders from the raster. The 4 long-standing vitest failures were stale SPEC expectations, not implementation bugs; suite is now 42/42.
- **Done 2026-08-23 (commit `9cef53f`)**: legend and crop-filter swatches now derive from the live `georaster.palette`, so they can no longer drift from the overlay. `resolveCropColors(palette)` in `crops.ts` returns a `Record<CropKey, string>`, falling back per-crop to the hardcoded `CROPS` hex when the palette is absent, missing that id, or has a transparent entry. The palette rides the same MapView → `+page.svelte` → component path that `cropStats` already used (`bind:cropPalette` beside `bind:cropStats`); `CropFilter`/`Legend` default the prop to `resolveCropColors()` so first paint before any search is still correct. `computeCropStats` reuses the same `paletteColor` conversion instead of its own inline one. Suite 51/51.
  - Hardcoded `CROPS` colors are retained deliberately as the pre-search fallback — do not delete them.
  - `cropPalette` is intentionally NOT cleared when an overlay is removed (unlike `cropStats`), since the CDL colormap is constant across bboxes/years and clearing would only flicker back to fallbacks mid-search.
  - Note the palette was verified against one raster (Eustis NE, 2024). Constancy across tiles/years is believed, not proven — but drift no longer matters visually now that swatches read from the raster.

## People / Roles

- Solo developer / project owner: wpknox
- No other collaborators at this time
