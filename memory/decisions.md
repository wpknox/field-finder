---
id: decisions
type: memory
description: Append-only log of architectural and product decisions with reasoning
related:
  - memory/CONTEXT.md
  - planning/features.md
  - CLAUDE.md
---

# Decision Log

> **Rules for this file:**
>
> - Append only. Never edit or delete existing entries.
> - One decision per entry, newest at the bottom.
> - Each entry answers: What was decided? Why? What was the alternative?

---

## Format

```
### [YYYY-MM-DD] Short title
**Decision:** ...

**Reason:** ...

**Alternatives considered:** ...
```

---

### [2026-03-17] Use SvelteKit as the framework

**Decision:** SvelteKit handles both frontend and backend in a single project.

**Reason:** Avoids maintaining two separate projects (e.g. a separate API server). Server routes handle CDL proxying natively. Well-suited for a small, self-contained app.

**Alternatives considered:** React + separate FastAPI/Flask backend; plain Vite + Express.

---

### [2026-03-17] Use SQLite (better-sqlite3) as the database

**Decision:** SQLite via `better-sqlite3`, with Drizzle ORM when a schema is needed.

**Reason:** The app is expected to serve <20 users. File-based DB means zero infra overhead. No need for Postgres or a hosted DB service at this scale.

**Alternatives considered:** Postgres, PlanetScale, Turso (libSQL). All overkill for this use case.

---

### [2026-03-17] Defer database until a concrete feature requires it

**Decision:** Do not scaffold a DB schema or add `better-sqlite3` until a specific feature (e.g. saved locations, user accounts) actually needs it.

**Reason:** Keeps the initial app lean. Avoid over-engineering before requirements are clear.

**Alternatives considered:** Setting up the full schema upfront.

---

### [2026-03-17] Use Leaflet.js for the map

**Decision:** Leaflet.js via the `leaflet` npm package.

**Reason:** Open source, no API key required, well-supported in SvelteKit, already used by the original ff.py (via Folium).

**Alternatives considered:** Mapbox GL JS (requires API key/account), Google Maps (paid).

---

### [2026-03-17] Scaffold with Tailwind CSS included

**Decision:** Added Tailwind CSS at scaffold time alongside the core stack.

**Reason:** Lightweight utility-first styling fits the project's small scale. Easier than managing custom CSS for a map-focused UI. Included at scaffold time to avoid retrofitting later.

**Alternatives considered:** Plain CSS, UnoCSS, no framework.

---

### [2026-03-17] Fixed sidebar layout (Option B)

**Decision:** Collapsible left sidebar (~300px) with all controls; Leaflet map fills remaining viewport.

**Reason:** Keeps everything visible at once without collapsing/hiding panels. Simplest to build. For a small user group, the sidebar space trade-off is worth the clarity. Search bar fits comfortably at ~240px usable width.

**Alternatives considered:** Full-screen map with floating panels (Google Maps style); top controls + bottom stats drawer.

---

### [2026-03-17] Explicit search button — no auto-triggering

**Decision:** User must click a "Search" button to fetch crop data. Changing controls or clicking the map does NOT auto-trigger a search.

**Reason:** CDL API is slow (seconds per request). Auto-triggering would create terrible UX with constant loading, especially while the user is still adjusting settings. Map interactions (panning, zooming, clicking) are for investigating previous results, not triggering new ones.

**Alternatives considered:** Auto-search on control change, auto-search on map move.

---

### [2026-03-17] Defer Area Summary and Year Comparison from initial build

**Decision:** Area Summary (crop % breakdown) and Year Comparison (toggle between two years) are deferred to follow-up iterations.

**Reason:** Area Summary requires server-side raster/GeoTIFF processing (GDAL or equivalent) — significant complexity. Year Comparison doubles CDL API calls and adds overlay-switching UI. Both are high-value but not essential for the core search-and-overlay loop.

**Alternatives considered:** Including them in v1.

---

### [2026-03-17] Extract lat/lon bbox math to shared `geo.ts` module

**Decision:** `computeBboxLatLon` lives in `src/lib/geo.ts` (no proj4 dependency) so both client (MapView bounding box rectangle) and server (coordinate projection) can import it.

**Reason:** The client needs this function to draw the real-time bounding box preview on the map. If it lived in `src/lib/server/`, client-side code couldn't import it.

**Alternatives considered:** Duplicating the formula in MapView; keeping all coordinate math server-only.

---

### [2026-03-18] Proxy CDL PNG through server as base64 data URL

**Decision:** After `GetCDLImage` returns a PNG URL, the server fetches the PNG, encodes it as base64, and returns a `data:image/png;base64,...` string to the client. Leaflet renders the data URL directly.

**Reason:** NASS servers (`nassgeodata.gmu.edu`) do not send CORS headers. Leaflet loading the PNG directly from the browser fails with a CORS error even though the HTTP response succeeds (status 200). Proxying through the server eliminates the CORS issue entirely.

**Alternatives considered:** A separate `/api/proxy-image?url=...` endpoint (extra round-trip); `crossOrigin: 'anonymous'` on the Leaflet overlay (doesn't help when the server sends no CORS headers).

---

### [2026-03-18] `GetCDLImage` returns `<returnURLArray>`, not `<returnURL>`

**Decision:** `parseReturnUrl` uses the regex `/<returnURL(?:Array)?>(.*?)<\/returnURL(?:Array)?>/` to handle both tag names.

**Reason:** Discovered at runtime — `GetCDLFile` and `ExtractCDLByValues` return `<returnURL>` but `GetCDLImage` returns `<returnURLArray>`. The CDL API documentation does not clearly distinguish these. A single flexible regex is cleaner than two separate parsers.

**Alternatives considered:** Separate `parseReturnUrlArray` function; string replace before parsing.

---

### [2026-03-18] `mapReady` sentinel to bridge async Leaflet init with Svelte 5 `$effect`

**Decision:** A `mapReady = $state(false)` flag is set to `true` inside the Leaflet import `.then()` callback. All `$effect` blocks that need the map check `if (!mapReady) return` as their first line.

**Reason:** Leaflet must be loaded via dynamic import in `onMount` (SSR safety). `$effect` runs synchronously and reactively, but the Leaflet `Map` instance only exists after the async import resolves. The sentinel makes the effects re-run once Leaflet is ready without polling or manual coordination.

**Alternatives considered:** Storing the Leaflet instance as `$state` and checking `if (!map)` directly (works but less explicit); async `onMount` (causes TypeScript error — cleanup return type becomes `Promise<() => void>` instead of `() => void`).

---

### [2026-03-18] Sync `onMount` with `.then()` for Leaflet import

**Decision:** `onMount(() => { import('leaflet').then(...); return () => map?.remove(); })` — sync function, cleanup returned immediately.

**Reason:** Svelte's `onMount` expects `void | (() => void)`. An `async` `onMount` returns `Promise<() => void>`, which Svelte ignores — the cleanup function never runs. Using `.then()` inside a sync `onMount` lets the cleanup be returned correctly while still handling the async import.

**Alternatives considered:** `async onMount` (cleanup silently dropped); top-level `import` of Leaflet (breaks SSR).

---

### [2026-03-19] Live bounding box update during center marker drag

**Decision:** The `drag` event on the center marker directly calls `bboxRect.setBounds(...)` without touching `center` state. Only `dragend` updates `center` and calls `onMapClick`.

**Reason:** Before this change, the bbox only updated after drag ended — `dragend` set `center`, the bbox `$effect` reacted, and `bboxRect.setBounds` was called. The `$effect` also calls `marker.setLatLng` when `center` changes; doing that during an active Leaflet drag risks conflicting with Leaflet's own drag management. Keeping `drag` as a direct Leaflet call (bypassing Svelte state) avoids the conflict entirely and gives live feedback.

**Alternatives considered:** Updating `center` on every `drag` event (triggers `marker.setLatLng` mid-drag — potentially conflicting); using a separate `$state` for the live preview position (unnecessary complexity).

---

### [2026-03-19] SSE streaming for CDL search progress

**Decision:** `/api/search` returns a `ReadableStream` with `Content-Type: text/event-stream`. The server pushes `{ type: 'progress', message }` events after each CDL step, then a `{ type: 'done', pngUrl, bounds }` event when complete. The client reads the stream and updates a `loadingMessage` string shown on the map overlay.

**Reason:** The CDL pipeline has 4 sequential steps (GetCDLFile → ExtractCDLByValues → GetCDLImage → PNG download), each taking several seconds. A single JSON response gives users no feedback during the wait. SSE keeps all CDL calls server-side (no CORS), uses one endpoint, and streams real-time step names to the UI without polling.

**Alternatives considered:** Three separate API endpoints per step (exposes intermediate CDL URLs to client, more endpoints to maintain); polling a status endpoint (requires server-side state); single JSON response with no progress (original approach — poor UX for slow API).

---

### [2026-03-19] `panVersion` counter to trigger map pan on address search

**Decision:** A `panVersion: number` prop on MapView is incremented in `handleLocationSelect` (address search / lat-lon input) but NOT in `handleMapClick` or marker `dragend`. A dedicated `$effect` in MapView watches `panVersion` and calls `map.panTo(center)` when it changes.

**Reason:** When a user searches a new location, the marker and bounding box jump to it but the map viewport stays put — jarring UX. Panning on every `center` change would also fire during drag (where the map is already correct) and on map clicks (where the user just clicked the visible area). The counter isolates the pan intent to address search only, with no ambiguity.

**Alternatives considered:** `isDragging` flag (timing issue — set to false before `$effect` fires after dragend); separate `panTo` prop (same idea, but a counter handles repeated searches to the same coordinates correctly where a value comparison would not).

---

### [2026-04-02] LoadingOverlay extracted to dedicated component

**Decision:** The loading state UI lives in `LoadingOverlay.svelte` rather than inline in `MapView.svelte`. Oscillating dots use a `setInterval` inside a `$effect` (starts when `message` becomes truthy, clears on teardown). The dots span has a fixed width (`w-5`) to prevent the box from resizing as dot count changes.

**Reason:** The inline block was growing (spinner, animated text) to the point where it warranted a named component. The fixed-width span detail is non-obvious — without it the card jitters on every dot tick.

**Alternatives considered:** CSS-only dot animation (harder to sync start with message arrival); animating opacity of pre-rendered dots (more DOM nodes, trickier timing).

---

### [2026-04-04] Replace PNG overlay with GeoTIFF + georaster-layer-for-leaflet

**Decision:** Server downloads the raw `.tif` binary from CDL (skipping `GetCDLImage`), base64-encodes it, and sends it via SSE. The client decodes and renders it with `georaster` + `georaster-layer-for-leaflet` as a `GridLayer`.

**Reason:** The PNG `imageOverlay` is a fixed-resolution bitmap — it pixelates when the user zooms in. `georaster-layer-for-leaflet` extends `L.GridLayer` and re-renders tiles per zoom level from the raw raster data, so the overlay stays sharp at any zoom.

**Alternatives considered:** Fetching the PNG at higher resolution (CDL API doesn't support resolution parameter); keeping PNG with `maxNativeZoom` to lock zoom (hides the problem rather than solving it).

---

### [2026-04-04] Two separate `$effect`s for tifBase64 vs overlayOpacity in MapView

**Decision:** One `$effect` tracks only `tifBase64` (triggers full decode + `parseGeoraster` + new layer). A second `$effect` tracks only `overlayOpacity` (calls `layer.setOpacity()` directly, no re-parse).

**Reason:** Opacity changes should be instant. If opacity was a dependency of the main effect, every slider tick would trigger a full GeoTIFF re-parse (seconds of work). `untrack()` is used inside the main effect to read `overlay` (cleanup) and `overlayOpacity` (initial value) without registering them as reactive dependencies.

**Alternatives considered:** A single combined effect with a stale-check flag (works, but harder to reason about); storing opacity as a separate layer option object (reactive overhead for no gain).

---

### [2026-04-04] `handedOffToMap` flag to coordinate loading state between page and MapView

**Decision:** `handleSearch` in `+page.svelte` sets `handedOffToMap = true` when it receives the SSE `done` event (meaning the tif is ready). The `finally` block clears `loadingMessage` only if `handedOffToMap` is false.

**Reason:** After the `done` event, `loadingMessage` is still needed — MapView takes ~1s to decode and render the GeoTIFF. If `finally` cleared it, the loading overlay would disappear before rendering finished. MapView clears `loadingMessage` itself when rendering completes.

**Alternatives considered:** A shared loading state or event bus (overkill for two components); always clearing in `finally` (causes a flash where the overlay disappears mid-render).

---

### [2026-04-04] Client-side crop statistics from georaster.values

**Decision:** `computeCropStats` iterates `georaster.values[0]` (the pixel value band) in the browser to count crop type occurrences and compute percentages.

**Reason:** `georaster-layer-for-leaflet` already parses the full raster client-side — `georaster.values[0]` contains all pixel data. No extra server round-trip needed. The original `features.md` note said this "requires server-side raster processing" but that was written before the GeoTIFF pipeline was designed.

**Alternatives considered:** Server-side pixel counting (extra API response data, more server work); using a Web Worker for the pixel iteration (unnecessary — it's fast enough on the main thread for typical CDL file sizes).

---

### [2026-04-04] Shared `src/lib/projections.ts` for EPSG:5070 proj4 string

**Decision:** The EPSG:5070 Albers proj4 definition string lives in `src/lib/projections.ts` and is imported by both `src/lib/server/coordinates.ts` (server-side bbox projection) and client-side code.

**Reason:** The string was previously hardcoded twice. A shared module avoids the strings diverging.

**Alternatives considered:** Keeping it in `coordinates.ts` (server-only, can't import on client without breaking SSR boundaries); inlining both copies (duplication risk).

---

### [2026-05-17] Buffer SSE stream to handle large base64 payloads

**Decision:** `+page.svelte` accumulates SSE chunks in a `buffer` string, splits on `\n`, and holds any incomplete trailing line for the next chunk. Uses `decoder.decode(value, { stream: true })` for correct multi-byte handling.

**Reason:** The GeoTIFF base64 payload (~400KB+) spans many TCP chunks. The previous code called `decoder.decode(value).split('\n')` per chunk — when the `data:` line for the `done` event was split across chunks, `JSON.parse` threw on the incomplete fragment, silently caught with no console output and showing the error toast.

**Alternatives considered:** Sending the GeoTIFF via a separate HTTP endpoint instead of SSE (extra round-trip, more endpoints); reducing payload size server-side (would require re-encoding or compression).

---

### [2026-05-17] Hybrid GeoTIFF render: georaster.toCanvas() + L.imageOverlay

**Decision:** The GeoTIFF is parsed with `georaster` for pixel data and crop stats, then rendered once to a canvas via `georaster.toCanvas()`, converted to a data URL, and placed on the map as `L.imageOverlay` using the lat/lon bounds from `computeBboxLatLon`.

**Reason:** `georaster-layer-for-leaflet` (the previous approach) re-renders tiles on every zoom level, causing noticeable lag. It also failed to resolve CDL's projection code 32767 (user-defined EPSG:5070) despite various proj4 registration attempts. `L.imageOverlay` is a static bitmap — Leaflet scales it on zoom with no re-computation, identical performance to the original PNG overlay. The GeoTIFF is still fetched for `georaster.values` (crop stats) and `georaster.palette` (correct CDL colors).

**Alternatives considered:** Lowering `resolution` further in GeoRasterLayer (reduced lag but didn't eliminate it, still had projection issues); going back to CDL's `GetCDLImage` PNG (loses client-side crop stats, adds one more API step).

---

### [2026-05-17] CDL_LABELS for comprehensive name lookup; georaster.palette for stat colors

**Decision:** `crops.ts` exports `CDL_LABELS: Record<number, string>` covering all 130 CDL values. `computeCropStats` accepts `georaster.palette` (256-entry RGBA array indexed by CDL value ID) and uses it for colors when available, falling back to `CROPS` color then gray.

**Reason:** Without `CDL_LABELS`, any CDL value not in the 13-entry `CROPS` filter dict appeared as `Other (ID: X)` in AreaSummary — most land cover types (forest, developed, shrubland, wetlands) were unlabeled. `georaster.palette` contains the exact official CDL colors embedded in the file, ensuring AreaSummary swatches match the rendered overlay precisely.

**Alternatives considered:** Hardcoding all 130 colors in `CROPS` (would need to maintain a parallel color list; palette already has the right values); making filter checkbox colors reactive from the palette (colors would only be correct after first search — jarring UX).

---

### [2026-03-18] Stable session ID counter for waypoint markers

**Decision:** Waypoints use an incrementing integer counter (`waypointIdCounter`) as a stable session ID. Two parallel Maps — `waypointData: Map<number, Waypoint>` and `waypointMarkers: Map<number, Marker>` — are keyed by this ID.

**Reason:** After a waypoint is deleted, array indices shift. Event listeners for save/delete are closed over the ID at creation time, so using array index caused listeners to target wrong waypoints after deletions. A stable counter ID stays correct across deletions.

**Alternatives considered:** Array index as key (breaks after deletion); random UUID (works, but overkill for a session-scoped structure).

---

### [2026-08-23] Custom palette renderer replaces georaster.toCanvas()

**Decision:** Render the GeoTIFF with our own `rasterToRgba` (`src/lib/renderGeoraster.ts`): full-resolution canvas, colors looked up in `georaster.palette`, noData transparent. `MapView.svelte` calls the browser-only `rasterToDataUrl(...)` wrapper instead of `georaster.toCanvas()`.

**Reason:** `georaster-to-canvas` caps output at 100×100 (`Math.min(georaster.height, 100)`) and renders single-band rasters as min/max-scaled grayscale — it never reads `georaster.palette`, confirmed by reading `node_modules/georaster-to-canvas/index.js`. The 2026-05-17 "Hybrid GeoTIFF render" decision assumed `toCanvas()` used the embedded palette and was committed while the CDL API was down, so it was never actually verified. Confirmed live on 2026-08-23: the overlay rendered as a blurry 100×100 grayscale blob.

**Verification (2026-08-23, Playwright, radius 10mi, year 2024, test location 40.553950/-100.076157):** overlay image measured 1114×1128 — matches `georaster.width/height`, not capped at 100×100. Pixel-decoded the resulting data URL and found 30 distinct colors, all real CDL palette entries. Pixel ratios (Grassland/Pasture 59.3%, Corn 24.5%, Soybeans 5.3%, Winter Wheat 2.7%) matched the Area Summary percentages exactly. Screenshot showed crisp center-pivot circles and rectangular fields in correct crop colors over a legible OSM base map at 70% opacity. Opacity slider updates the same `<img>` node instantly (`setOpacity` only, no re-parse). Zero application console errors.

**Runtime finding that makes a coalesce load-bearing:** `georaster.noDataValue` is `null` at runtime and `georaster.palette[0]` is opaque black (`[0,0,0,255]`). Without a `?? 0` fallback, value-0 background pixels render as opaque black specks instead of transparent. Initially only the render call coalesced while `computeCropStats` received the raw `null` — which it treats as "count every pixel" — so value 0 was transparent on the map but still counted in the sidebar as a bogus `Unknown (ID: 0) — 0.2%` row. Resolved in `dbf4bcf` by hoisting a single `const noData = georaster.noDataValue ?? 0` and passing it to both call sites. `computeCropStats` skips excluded pixels before incrementing `total`, so the remaining percentages renormalize correctly; verified live that the bogus row is gone.

**Alternatives considered:** Passing `{width, height}` options to `toCanvas()` (fixes resolution but the output is still grayscale, no palette support); patching `georaster-to-canvas` itself (external dependency churn for what is ~30 lines of replacement code).

**Supersedes:** [2026-05-17] Hybrid GeoTIFF render: georaster.toCanvas() + L.imageOverlay — that entry's premise (toCanvas renders using the embedded palette) was incorrect; left in place per the append-only rule.

---

### [2026-08-23] CROPS colors sourced from the raster palette, not the published CDL legend

**Decision:** Set all 13 `CROPS` filter/legend colors from the `georaster.palette` embedded in a live CDL raster. 12 of the 13 were wrong (only Sorghum `#FF9E0A` matched). Corn is recorded as `#FFD200`, deliberately differing from the `#FFD300` published on the CropScape legend page.

**Reason:** The overlay is painted directly from `palette[value]` (`renderGeoraster.ts`), so the raster's colormap — not the published legend — is what appears on screen. Legend swatches must match the pixels beside them. The corn discrepancy is real, not a rounding artifact: the raw TIFF `ColorMap` green channel is `53970` = `210 x 257` exactly, and every entry is an exact multiple of 257, so the 16-to-8-bit conversion is lossless. The raster says 210.

**Also settled:** the `Other (ID: n)` -> `Unknown (ID: n)` label change in `cropStats.ts` was deliberate, made in `065cdd1` alongside the 130-entry `CDL_LABELS` table; `Unknown` now means "outside the CDL domain entirely," a narrower case than the old `Other`. The 4 long-failing tests were stale spec expectations, not implementation bugs — the specs were corrected, not the code.

**Alternatives considered:** Trusting the published CropScape legend hexes (would leave swatches visibly off by one from the overlay); deriving swatches from `georaster.palette` at runtime (structurally correct and immune to drift, but touches `MapView.svelte` and only helps once a raster is loaded — left as a follow-up).

**Caveat:** Ground truth came from one raster (Eustis NE, 2024, 10mi). The CDL colormap is believed constant across tiles and years but that was not verified.

---

### [2026-08-23] Legend and filter swatches derive from the live raster palette

**Decision:** `resolveCropColors(palette)` (`src/lib/crops.ts`) resolves each of the 13 `CROPS` entries to the color in the live `georaster.palette`, falling back per-crop to the hardcoded hex when the palette is absent, lacks that CDL id, or has a fully transparent entry. The palette is lifted out of `MapView.svelte` via a bindable `cropPalette` prop — the same path `cropStats` already travelled — and `CropFilter`/`Legend` take a `colors` prop defaulting to `resolveCropColors()`.

**Reason:** The overlay paints straight from `palette[value]`, so hardcoded swatch hexes are a second source of truth that can silently drift from the pixels beside them. That drift had already happened: 12 of 13 colors were wrong before `7778cb6`. Reading swatches from the same array the renderer uses makes a recurrence structurally impossible rather than merely corrected.

**Why the hardcoded colors stay:** the sidebar and legend render on first paint, before any search and with no raster in existence. They must look right then, so the hex values remain as fallback defaults rather than being deleted.

**Alternatives considered:** Passing the raw 256-entry palette down to each component (components only need "what color is this crop", and the fallback logic would end up duplicated in markup); a store or context (the codebase already had a working prop-drilling pattern for `cropStats` — no reason to introduce a second mechanism); deleting the hardcoded hexes entirely (breaks pre-search first paint).

**Side effect worth knowing:** `computeCropStats` now shares the `paletteColor` conversion instead of its own inline one, which means it newly rejects fully transparent palette entries. No real CDL class is affected (alphas are 255), and rejecting them is correct for a swatch.

---

### [2026-08-26] Search results travel as a fresh `SearchResult` object, not a bare base64 string

**Decision:** `handleSearch` snapshots `{lat, lon, radius}` _before_ issuing the request and, on the SSE `done` event, hands MapView a brand-new `SearchResult` object (`src/lib/searchResult.ts`) containing those values plus `tifBase64`. MapView's overlay `$effect` places the raster from that snapshot and guards staleness on **object identity** rather than on the base64 string.

**Reason:** Two bugs shared one root cause. The effect previously read `center`/`radius` with `untrack()` _inside itself_, but the effect runs when the raster arrives — after a multi-second fetch — so it captured render-time values, and dragging the marker mid-fetch drew the raster at the wrong place and size (audit B2). Separately, `tifBase64 = event.tifBase64` is a same-value primitive write when a repeated identical search returns identical bytes; Svelte 5 skips notification, the effect never re-runs, and nothing clears `loadingMessage` — soft-locking the Search button (audit B3). A fresh object identity per search fixes B3 structurally, and feeding the request body and the result object from the same three locals makes B2 impossible by construction rather than by guarding against it: the bbox that was searched and the bbox that is drawn cannot drift apart.

**Why identity guards are safe here:** the guards read `searchResult` inside an async closure after `await` points, so `active_reaction` is null and they register no dependency — no self-retriggering loop. Destructured props compile to live getters, so they still observe the current value, which is exactly what a staleness check needs.

**Consequence to respect:** MapView now has two sources of position that are _not_ interchangeable — live `center`/`radius` (marker, bbox preview) and the frozen snapshot (overlay). This is documented at the prop declarations and the destructured values are named `searchLat`/`searchLon`/`searchRadius` so a stray use of the live values reads as obviously wrong.

**Alternatives considered:** Keeping the string prop and adding a separate incrementing `searchVersion` counter (works, but leaves the placement values ambient and re-introduces two things that must be kept in sync); snapshotting into module-level state (invisible to the reactivity graph, and untestable).

**Known gap:** `SearchResult` deliberately omits `year` and `crops`. Year comparison will need `year` — decide then rather than rediscovering it (audit F2).

---

### [2026-08-26] CDL fetches carry an `AbortSignal.timeout`; the year range is one constant

**Decision:** All three server-side CDL requests take `AbortSignal.timeout()` — `CDL_TIMEOUT_MS = 60_000` for the two metadata calls, `2×` that for the raster download, since the raster can be tens of MB. A timeout is rethrown as `CdlTimeoutError` and reported to the client as "USDA CDL service is not responding — try again later", distinct from the generic failure message. Separately, the CDL year range moved from three hardcoded sites into `src/lib/constants.ts` (`CDL_MIN_YEAR`, `CDL_MAX_YEAR`, `CDL_YEARS`).

**Reason:** NASS does not error when it is unhealthy — it _hangs_. Measured on 2026-08-26: `status=000 size=0 time=40.001s` while the host itself answered (CropScape returned 302). With no signal attached, the SSE stream stayed open and the client spun forever with no error, which turned the long-standing "CDL API intermittently down" blocker into an indefinite spinner. The distinct message matters because "try again later" is actionable and "something failed" is not. `fetchCdlData` takes an optional fourth `timeoutMs` parameter purely so tests can drive a 50ms timeout instead of waiting a minute.

**On the year range:** it was pinned at 1997–2024 in the dropdown, the default state, and the server validator, and it goes stale every winter when NASS publishes the prior year. `CDL_MAX_YEAR` stays **2024** for now — whether the 2025 layer exists could not be determined because every probe hung. The point of the refactor is that confirming it later is a one-line change.

**Alternatives considered:** A wrapper with retry/backoff (retrying a service that hangs for 40s multiplies the wait; the user is sitting in front of a spinner — fail fast and let them retry); a single global timeout across the whole chain (obscures which step stalled, and the raster download legitimately needs a larger budget than a metadata call); deriving `CDL_MAX_YEAR` from the current date (guesses at NASS's publication schedule and would silently offer a year that does not exist).
