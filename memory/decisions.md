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
