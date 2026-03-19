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
