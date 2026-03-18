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

_Nothing yet — project is in setup/planning phase._

---

## In Progress

_Nothing yet._

---

## Planned (Near-Term)

These mirror what `ff.py` already does, translated to the webapp:

- [ ] Address search bar with geocoding (Nominatim)
- [ ] Interactive map (Leaflet) centered on searched location
- [ ] Radius selector (slider or dropdown, in miles)
- [ ] Year selector (2000–2024)
- [ ] Crop filter checkboxes (toggle which CDL crop types to show)
- [ ] CDL PNG overlay on the map
- [ ] Color legend always visible on the map
- [ ] Marker for the searched/selected location
- [ ] Server-side proxy for CDL API calls (avoids CORS, keeps logic clean)

---

## Ideas / Future Features

These are expansion ideas beyond what the CLI does:

- [ ] **Saved locations** — users can bookmark lat/lon + name for quick access
- [ ] **Year comparison** — side-by-side or toggle between two years for the same area
- [ ] **Crop area stats** — show approximate acreage or % coverage per crop type in the bounding box
- [ ] **Custom bounding box** — let user draw a box on the map instead of radius-from-point
- [ ] **Share link** — URL encodes location/radius/year so a view can be shared
- [ ] **Export** — download the PNG or the map as a file (like the CLI does)
- [ ] **User accounts** — light auth so users can save their own locations/sessions
- [ ] **Saved searches** — store past queries with results for quick reload
- [ ] **Notifications / alerts** — "notify me when 2025 data is available for this area"
- [ ] **Mobile-friendly layout** — touch-friendly controls, responsive map

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
