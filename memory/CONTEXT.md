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

**field-finder** is a SvelteKit webapp that lets users explore USDA crop data overlaid on an interactive map. It replaces a clunky Python CLI (`../ff-py/ff.py`) with a real-time, browser-based experience.

## Current State

- **Phase**: Design & planning complete — ready to begin implementation
- **What exists**: Full SvelteKit project scaffolded with npm, TypeScript, Prettier, ESLint, Vitest, Tailwind CSS, Drizzle (SQLite/better-sqlite3)
- **Database**: Drizzle configured, `DATABASE_URL=local.db` in `.env` — no schema defined yet (deferred until needed)
- **What doesn't exist yet**: Any app-specific code — routes, components, API endpoints, map integration
- **Design spec**: `docs/superpowers/specs/2026-03-17-initial-webapp-design.md` — approved
- **Implementation plan**: `docs/superpowers/plans/2026-03-17-initial-webapp.md` — 16 tasks, reviewed and approved

## Core User Flow (Target)

1. User types an address or drops a pin on the map
2. Selects a year (1997–2024) and radius (miles)
3. Optionally filters to specific crop types via checkboxes
4. Server fetches CDL data and returns a PNG overlay
5. PNG is rendered on the Leaflet map with a color legend

## Key Technical Facts to Remember

- CDL API calls **must be server-side** — CORS blocks browser-direct requests
- Input coordinates: EPSG:4326 → must project to EPSG:5070 (Albers) for CDL bbox
- CDL API is slow (seconds per request) — the UI must show loading state
- Nominatim geocoding: 1 req/sec rate limit, requires `User-Agent` header
- The CDL PNG is served from NASS servers and loaded by Leaflet directly in the browser

## Active Work / What We're Doing Now

_(update this section at the start and end of each session)_

- Design spec and 16-task implementation plan are complete and committed.
- **Next step**: Begin executing the plan (Task 1: install Leaflet + proj4 dependencies).
- User has not yet chosen execution mode (subagent-driven vs inline). Ask at session start.

## People / Roles

- Solo developer / project owner: wpknox
- No other collaborators at this time
