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

### [2026-03-18] Stable session ID counter for waypoint markers

**Decision:** Waypoints use an incrementing integer counter (`waypointIdCounter`) as a stable session ID. Two parallel Maps — `waypointData: Map<number, Waypoint>` and `waypointMarkers: Map<number, Marker>` — are keyed by this ID.

**Reason:** After a waypoint is deleted, array indices shift. Event listeners for save/delete are closed over the ID at creation time, so using array index caused listeners to target wrong waypoints after deletions. A stable counter ID stays correct across deletions.

**Alternatives considered:** Array index as key (breaks after deletion); random UUID (works, but overkill for a session-scoped structure).
