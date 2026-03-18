# Field Finder — Initial Webapp Design

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Core webapp shell — location search, crop data overlay, and map interaction

---

## Purpose

Field Finder is a web app for upland bird hunters to scout locations by exploring USDA crop data on an interactive map. Hunters look for grain fields (sorghum, wheat, sunflower, corn) near cover (pasture, CRP, idle cropland) — the habitat pattern that attracts pheasant, quail, and dove.

This spec covers the initial build: a usable tool that lets a small group of hunting buddies pick a location, fetch crop data, and explore the results on a map.

---

## Users

A small group (<20) of hunting buddies. Not all are technically inclined, but the app owner can explain it in person. The UI must be clean and self-explanatory enough that after one walkthrough, users can operate it independently. No onboarding flow needed.

---

## Layout

Single-page app with two zones:

### Collapsible Left Sidebar (~300px)

Contains all controls, top to bottom:

1. **App title** — "Field Finder"
2. **Search bar** — text input with geocoding autocomplete. Accepts:
   - Address or place name (geocoded via Nominatim)
   - Raw lat/lon coordinates (e.g., `40.554, -100.076`) — parsed directly, no geocoding
   - Selecting a result or entering coordinates places the location marker and pans the map
3. **Radius slider** — range: 1–50 miles, default: 10 miles
   - Recommended range: 5–15 miles (no hard restriction)
   - Above 15 miles: subtle warning text appears — "Larger areas may take longer to load"
   - Changing the radius updates a **bounding box outline on the map in real time** (before Search is clicked), so the user can see exactly what area will be queried. This makes it clear that "radius" produces a square, not a circle.
4. **Year dropdown** — defaults to the latest available CDL year (initially hardcoded; dynamic discovery is a future improvement)
5. **Crop type checkboxes** — each with a color swatch matching the map legend
   - Default: all crops shown (all checkboxes checked). Users uncheck what they don't care about.
   - Checkbox state persisted to localStorage — user's filter preferences are restored on next visit.
6. **Search button** — explicitly triggers the CDL data fetch. Disabled during loading.
7. **Area Summary** *(deferred — see Server Architecture note)* — will show percentage breakdown per crop type. Requires raster processing server-side; not in initial build.
8. **Collapse toggle** (◀/▶) — hides/shows the sidebar to maximize map space

### Map (fills remaining viewport)

Leaflet.js interactive map:

- **Base tile layer** — street or satellite tiles
- **Bounding box outline** — a rectangle drawn on the map showing the query area. Updates in real time as the user changes the radius slider or moves the location marker. Visible before and after searching. Makes it clear the search area is a square, not a circle.
- **CDL crop overlay** — PNG image overlay, positioned by bounding box coordinates. Updates only when the user clicks Search.
- **Location marker** — marks the search center point. Set by address search, coordinate entry, or map click. Clicking the map moves this marker (and the bounding box outline) but does NOT trigger a search.
- **User waypoints** — persistent markers the user drops to flag spots of interest (field edges, access points, ponds). Optionally named. Visually distinct from the location marker (different color/icon). Persist across searches. Created via right-click (desktop) or long-press (mobile). Click a waypoint to rename or delete it.
- **Color legend** — floating panel in the bottom-left corner of the map. Always visible. Uses the same color definitions as the sidebar crop checkboxes.

---

## Interaction Flow

### First Load

1. Check localStorage for last search location
2. If found: center map on that location, restore previous settings
3. If not found: center on the continental US (~39.8°N, ~98.5°W), zoomed out
4. Sidebar open, controls at defaults, no crop overlay — clean map ready for input

### Search Flow

1. User sets a location via one of three methods:
   - Types an address → autocomplete dropdown → selects a result → location marker placed, map pans
   - Types/pastes lat/lon coordinates → location marker placed, map pans
   - Clicks the map → location marker moves to click point
2. User adjusts radius, year, and crop filters as desired
3. User clicks **Search**
4. Loading indicator appears over the map
5. Server-side route processes the request:
   - Projects coordinates from EPSG:4326 to EPSG:5070 (Albers Equal Area)
   - Computes bounding box from center + radius
   - Calls CDL API chain: `GetCDLFile` → `ExtractCDLByValues` (if crop filter active) → `GetCDLImage`
   - Returns PNG URL + bounding box coordinates
6. Leaflet renders the PNG as an image overlay on the map
7. Loading indicator clears
8. Last search location saved to localStorage

### Waypoint Flow

1. User right-clicks the map (or long-presses on mobile) → waypoint marker drops
2. Optional popup to name the waypoint (can be dismissed without naming)
3. Waypoint is visually distinct from the location marker
4. Waypoints persist across searches — they are independent of the crop overlay
5. Click a waypoint to see its name, rename it, or delete it
6. Waypoints stored in localStorage

### Year Comparison Flow (Deferred — Not in Initial Build)

Year comparison is valuable but adds complexity (doubles CDL API calls, overlay-switching UI). It is deferred to a follow-up iteration after the core search-and-overlay loop is solid. The `YearSelector` component in the initial build only shows a single year dropdown.

**When implemented later:**
1. User selects a "compare to" year alongside the primary year
2. On Search, both years' crop data are fetched
3. User can toggle between the two overlays — one visible at a time
4. Further enhancement: independent opacity sliders per year layer for blending

---

## Server Architecture

### API Routes

**`POST /api/search`** — main CDL data endpoint

- Request body: `{ lat: number, lon: number, radius: number, year: number, crops: number[] }`
- Server-side processing:
  1. Compute bounding box in lat/lon: center ± radius using degrees-per-mile conversion (lat: `miles / 69.0`, lon: `miles / (69.0 * cos(radians(lat)))`)
  2. Project the four bbox corners from EPSG:4326 → EPSG:5070 using `proj4` library — this matches the approach used by the original `ff.py`
  3. Call `GetCDLFile?year=YYYY&bbox=xmin,ymin,xmax,ymax` (EPSG:5070 coords) → parse XML for raster URL
  4. If crop filter active: call `ExtractCDLByValues?file=URL&values=csv_ids` → parse XML for filtered raster URL
  5. Call `GetCDLImage?files=URL&format=png` → parse XML for PNG URL
  6. Project the EPSG:5070 bbox corners back to EPSG:4326 for Leaflet overlay positioning
- Response: `{ pngUrl: string, bounds: [[south, west], [north, east]] }`

**Note on Area Summary stats:** The CDL API does not return crop statistics directly. Computing pixel-count breakdowns requires downloading and parsing the raster (GeoTIFF) file server-side, which adds significant complexity (GDAL or equivalent library). For the initial build, Area Summary is deferred. It will be implemented once the core overlay pipeline is working and we can evaluate raster processing options.

**`GET /api/geocode?q=...`** — Nominatim proxy

- Proxies search requests to Nominatim
- Sends required `User-Agent` header
- Enforces 1 request/second rate limit server-side
- Returns array of `{ display_name, lat, lon }` results

### Why Server-Side

- CDL API has CORS restrictions — browser cannot call it directly
- Coordinate projection math stays in one place
- Rate limiting for Nominatim is easier to enforce server-side
- Enables future caching (same location+year+crops = same result)

---

## Shared Data

### Crop Configuration — Single Source of Truth

```ts
// src/lib/crops.ts
export const CROPS = {
  sorghum:    { id: 4,   name: 'Sorghum',        color: '#FF8C00' },
  winterWheat:{ id: 24,  name: 'Winter Wheat',    color: '#8B4513' },
  springWheat:{ id: 23,  name: 'Spring Wheat',    color: '#D2B48C' },
  corn:       { id: 1,   name: 'Corn',            color: '#FFFF00' },
  soybeans:   { id: 5,   name: 'Soybeans',        color: '#008000' },
  sunflower:  { id: 6,   name: 'Sunflower',       color: '#DAA520' },
  oats:       { id: 28,  name: 'Oats',            color: '#800080' },
  barley:     { id: 21,  name: 'Barley',          color: '#FF00FF' },
  alfalfa:    { id: 36,  name: 'Alfalfa',         color: '#FFC0CB' },
  pasture:    { id: 176, name: 'Pasture/Grass',   color: '#90EE90' },
  fallow:     { id: 61,  name: 'Fallow/Idle',     color: '#808080' },
  openWater:  { id: 111, name: 'Open Water',      color: '#4169E1' },
  wetlands:   { id: 190, name: 'Wetlands/Rivers', color: '#ADD8E6' },
} as const;
```

All components that display crop information (`CropFilter`, `Legend`, `AreaSummary`) read from this single config. One place to update colors or add new crop types.

### Client-Side Persistence (localStorage)

- **Last search location** — `{ lat, lon }` restored on next visit
- **Last radius** — number (miles), restored on next visit
- **Waypoints** — array of `{ lat, lon, name?: string }` persisted independently of searches
- **Crop filter state** — which checkboxes are checked/unchecked, restored on next visit
- **Sidebar collapse state** — boolean

No database needed for the initial build.

---

## Component Breakdown

### Svelte Components

| Component | Responsibility |
|---|---|
| `+page.svelte` | Top-level layout: sidebar + map split |
| `Sidebar.svelte` | Collapsible container for all controls |
| `SearchBar.svelte` | Address autocomplete + lat/lon parsing |
| `RadiusSlider.svelte` | Slider input with value display + warning text |
| `YearSelector.svelte` | Primary year dropdown (compare-to added later) |
| `CropFilter.svelte` | Checkboxes with color swatches, reads from `CROPS` config |
| `SearchButton.svelte` | Triggers search, disabled during loading |
| `AreaSummary.svelte` | Percentage bars per crop, reads from `CROPS` config *(deferred — needs raster processing)* |
| `MapView.svelte` | Leaflet wrapper: overlays, markers, click events, legend |
| `Legend.svelte` | Floating color legend on the map, reads from `CROPS` config |
| `WaypointPopup.svelte` | Popup for naming/deleting waypoints |

### Server Modules (`src/lib/server/`)

| Module | Responsibility |
|---|---|
| `cdl.ts` | CDL API client: raster fetch, crop filtering, PNG URL retrieval |
| `geocode.ts` | Nominatim proxy with rate limiting |
| `coordinates.ts` | EPSG:4326 ↔ 5070 projection, bounding box math |

---

## Error Handling

All errors are shown inline — no modal dialogs.

| Scenario | Behavior |
|---|---|
| CDL API timeout or failure | Error message on the map: "Couldn't fetch crop data — try again" |
| Nominatim returns no results | Inline text below search bar: "No results found" |
| Nominatim rate limit | Debounce autocomplete (300–500ms), queue server-side at 1 req/sec |
| Invalid coordinates entered | Inline error below search bar if lat/lon is out of range |
| Radius above 15 miles | Warning text below slider: "Larger areas may take longer to load" |
| No crop data for year/area | Message on map: "No crop data available for this area in [year]" |
| CDL PNG fails to load | Handle Leaflet image error, show message on map |

---

## Out of Scope (Noted for Future)

These are explicitly not part of the initial build but are tracked for future work:

- **Area Summary / crop statistics** — requires server-side raster (GeoTIFF) processing to count pixels per crop type. High value; implement once core overlay pipeline is solid.
- **Year comparison** — toggle between two years' overlays. Deferred to reduce initial complexity (doubles CDL API calls, adds overlay-switching UI).
- **Year opacity blending** — independent opacity sliders per year overlay for visual comparison. Build after year comparison toggle works.
- **Water source data** — integrating external APIs (National Hydrography Dataset or similar) to show stock tanks, ponds, and watering holes. High value for dove hunting.
- **Habitat highlighting** — automatically identifying grain-adjacent-to-cover patterns. Needs accuracy validation before shipping.
- **CDL overlay opacity control** — simple opacity slider for the crop overlay so base map features (roads, landmarks) remain visible underneath. Low effort (Leaflet `setOpacity`), high usability value — strong candidate for early follow-up.
- **Saved locations / user accounts** — bookmarking + light auth (requires database)
- **Additional animal types** — waterfowl, big game scouting beyond upland birds
- **Mobile-optimized layout** — responsive sidebar behavior for touch devices
- **Export / share** — downloadable maps, shareable URLs
