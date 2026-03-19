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

## Implemented (v1)

All features from the initial build plan are complete and in PR #1.

- [x] Collapsible left sidebar with all controls
- [x] Address search bar with geocoding (Nominatim) + lat/lon coordinate input
- [x] Lat/lon coordinate display below search bar (updates on map click or address select)
- [x] Search bar clears when user clicks on the map
- [x] Interactive Leaflet map with click-to-set-location
- [x] Radius slider (1–50 mi, default 10, amber warning above 15)
- [x] Year dropdown (1997–2024, default latest)
- [x] Crop filter checkboxes with color swatches (persisted to localStorage)
- [x] Hint when no crops selected: "No crops selected — all crop data will be shown"
- [x] Explicit Search button (no auto-search)
- [x] Real-time bounding box preview rectangle on map
- [x] CDL PNG crop overlay (server-proxied as base64 to avoid CORS)
- [x] Collapsible color legend (floating on map)
- [x] Location marker (set by search, coordinates, or map click)
- [x] Right-click waypoints (optionally named, persist across sessions)
- [x] Server-side CDL API proxy (EPSG:4326→5070 projection, XML parsing)
- [x] Server-side Nominatim proxy with rate limiting
- [x] ErrorToast component (dismissable ✕ button, auto-dismisses after 5s)
- [x] localStorage persistence (location, radius, crop filters, waypoints, sidebar state)

---

## Planned (Near-Term Follow-ups)

High-value features deferred from initial build:

- [ ] **CDL overlay opacity control** — slider to adjust crop overlay transparency
- [ ] **Area Summary / crop statistics** — % breakdown per crop type (requires server-side raster processing)
- [ ] **Year comparison** — toggle between two years' overlays
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
- Must proxy CDL PNG server-side (NASS servers don't send CORS headers)
- Coordinate projection: input EPSG:4326 → bounding box EPSG:5070 (Albers) for CDL API
- CDL API returns XML; must parse `returnURL` and `returnURLArray` elements
- Year range currently supported by CDL: 1997–2024 (validate on input)
- Radius capped at 50 miles to avoid huge/slow requests

### Non-Functional
- Target user base: <20 people (small scale, no scaling concerns)
- DB if used: SQLite (file-based, zero infra)
- No paid API keys required for core functionality (Nominatim + CDL are free)

---

## Blockers / Known Issues

_None._

---

## Notes & Discoveries

- CDL API is slow — expect several seconds per request. Progress feedback in the UI is important.
- `GetCDLImage` returns `<returnURLArray>` (not `<returnURL>`) — the parseReturnUrl regex handles both.
- The CDL PNG must be proxied through the server (returned as base64 data URL) — NASS servers don't send CORS headers, so Leaflet can't load them directly from the browser.
- Nominatim rate limit: 1 request/second, must send a valid `User-Agent` header.
- The marker offset hack in `ff.py` (sliding the B&B marker north by 0.021°) is specific to that one location — not carried into the webapp.
