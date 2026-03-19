---
id: features
type: planning
description: Feature status tracker — implemented, in-progress, planned, ideas, requirements, blockers
related:
  - memory/CONTEXT.md
  - memory/decisions.md
  - CLAUDE.md
---

# Feature Log

## Implemented

_Nothing yet — implementation plan ready, execution not started._

---

## In Progress

Design & planning complete. See `docs/superpowers/plans/2026-03-17-initial-webapp.md` for the 16-task implementation plan.

---

## Planned (Initial Build — v1)

Covered by the implementation plan. Primary use case: **upland bird hunting** scouting.

- [ ] Collapsible left sidebar with all controls
- [ ] Address search bar with geocoding (Nominatim) + lat/lon coordinate input
- [ ] Interactive Leaflet map with click-to-set-location
- [ ] Radius slider (1–50 mi, default 10, warning above 15)
- [ ] Year dropdown (1997–2024, default latest)
- [ ] Crop filter checkboxes with color swatches (persisted to localStorage)
- [ ] Explicit Search button (no auto-search)
- [ ] Real-time bounding box preview rectangle on map
- [ ] CDL PNG crop overlay on the map
- [ ] Color legend (floating on map, shared colors with crop filter)
- [ ] Location marker (set by search, coordinates, or map click)
- [ ] User waypoints (right-click to drop, optionally named, persist across searches)
- [ ] Server-side CDL API proxy (EPSG:4326→5070 projection, XML parsing)
- [ ] Server-side Nominatim proxy with rate limiting
- [ ] localStorage persistence (location, radius, crop filters, waypoints, sidebar state)
- [ ] Error handling (inline, no modals)

---

## Planned (Near-Term Follow-ups)

High-value features deferred from initial build:

- [ ] **Area Summary / crop statistics** — % breakdown per crop type (requires server-side raster processing)
- [ ] **Year comparison** — toggle between two years' overlays
- [ ] **CDL overlay opacity control** — slider to adjust crop overlay transparency
- [ ] **Year opacity blending** — independent opacity per year for visual comparison

---

## Ideas / Future Features

- [ ] **Water source data** — stock tanks, ponds, watering holes (National Hydrography Dataset or similar). High value for dove hunting.
- [ ] **Habitat highlighting** — auto-identify grain-adjacent-to-cover patterns. Needs accuracy validation.
- [ ] **Saved locations / user accounts** — bookmarking + light auth (requires database)
- [ ] **Custom bounding box** — let user draw a box on the map instead of radius-from-point
- [ ] **Share link** — URL encodes location/radius/year so a view can be shared
- [ ] **Export** — download the PNG or the map as a file
- [ ] **Saved searches** — store past queries with results for quick reload
- [ ] **Additional animal types** — waterfowl, big game scouting beyond upland birds
- [ ] **Mobile-optimized layout** — responsive sidebar, touch-friendly controls

---

## Requirements

### Functional

- Must proxy CDL API calls server-side (CORS restriction)
- Coordinate projection: input EPSG:4326 → bounding box EPSG:5070 (Albers) for CDL API
- CDL API returns XML; must parse `returnURL` and `returnURLArray` elements
- Year range currently supported by CDL: 1997–2024 (validate on input)
- Radius should be capped at a sensible max (50 miles?) to avoid huge/slow requests

### Non-Functional

- Target user base: <20 people (small scale, no scaling concerns)
- DB if used: SQLite (file-based, zero infra)
- No paid API keys required for core functionality (Nominatim + CDL are free)

---

## Blockers / Known Issues

_None yet._

---

## Notes & Discoveries

- CDL API is slow — expect several seconds per request. Progress feedback in the UI is important.
- The CDL PNG images are served from NASS servers (not proxied), so the browser will fetch them directly. May need `crossOrigin` handling in Leaflet.
- Nominatim rate limit: 1 request/second, must send a valid `User-Agent` header.
- The marker offset hack in `ff.py` (sliding the B&B marker north by 0.021°) is specific to that one location — don't carry it into the webapp.
