# Field Finder — Property Lines, Aerial Imagery, and Public Land Design

**Date:** 2026-09-04
**Status:** Approved (design sections reviewed with the project owner in session)
**Scope:** Three optional map layers — an aerial imagery basemap, a parcel (property line) layer, and a public-land layer — plus the shared layer plumbing they need

---

## Purpose

Today the group scouts crops in Field Finder and then switches to onX Hunt to answer two follow-up questions: _where are the property lines_, and _is there water (a pond or stock tank) on this ground_. This spec brings both answers into Field Finder so the "who grows what, and where is the water on their land" loop happens on one map.

It does **not** attempt to replace onX. It adds the three pieces the group actually reaches for: aerial imagery to eyeball water, parcel boundaries with as much ownership detail as free public data allows, and public/walk-in land so the group knows where they may already hunt.

---

## Users and constraints carried forward

- Same audience as the initial design: a group of fewer than 20 hunters, one of whom (the owner) explains the app in person.
- **Free first, paid fallback.** No paid API in this scope. The architecture leaves a slot for a paid nationwide parcel provider (Regrid) but does not build it.
- **Coverage target is Nebraska plus neighbors.** Only Nebraska and Colorado have a confirmed free statewide parcel feature service. Everywhere else, the parcel layer reports "not available here yet" rather than failing.
- **Settled UX rules still apply:** no auto-triggered searches, inform-don't-restrict, localStorage persistence, legend swatches must match what is painted.
- **Yearly freshness is acceptable** for parcel data. Nebraska's statewide layer refreshes annually from county assessor data.

---

## Research findings this design rests on

Verified live on 2026-09-04 against the Eustis, NE test location (40.553950, -100.076157).

| Source                              | What it provides                                                                                                                                                                           | Verified facts                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USGS Imagery Only tile service      | NAIP-based aerial imagery, public domain, cached XYZ tiles, no key                                                                                                                          | ~0.35 s per tile; visible to 1:9,028 (≈ Leaflet zoom 16); URL pattern `.../USGSImageryOnly/MapServer/tile/{z}/{y}/{x}` (note `y` before `x`)                                                          |
| Nebraska Statewide Parcels          | Statewide polygons + assessor attributes, free ArcGIS FeatureServer, GeoJSON/PBF, pagination, 2,000 records per page                                                                       | 1,770 parcels in the 10 mi test bbox in 0.6 s / 1.3 MB. **No owner-name field.** Has `Parcel_ID`, `Situs_Address`, `Legal_Description`, `GIS_Acres`, `Irrigation_Type`, `County_ID`, `Parcel_URL` (often empty). Test point is a 473-acre Frontier County tract. License: "for general use and analysis within the state." |
| Colorado Public Parcels             | Statewide polygons, free ArcGIS FeatureServer, updated annually                                                                                                                            | Includes `owner`, `owner2`, `ownerAdd`, `situsAdd`, `landAcres`, `legalDesc`, `countyName`, `URL`                                                                                                     |
| PAD-US 4.1 Fee Managers (USGS)      | National public-land polygons with owner agency, manager, unit name, public access code (`OA` open, `RA` restricted, `XA` closed, `UK` unknown)                                            | 46 units in a 25 mi box around Eustis, including Darr Strip Wildlife Management Area                                                                                                                  |
| Nebraska Open Fields and Waters     | Nebraska Game & Parks walk-in tracts for the current season, ArcGIS FeatureServer                                                                                                           | 83 tracts in the same 25 mi box. Service name carries the season (`OFW_2026_2027_...`), so the URL changes yearly                                                                                       |
| USGS NHDPlus HR / 3DHP water bodies | Pond/lake/reservoir polygons                                                                                                                                                               | 1,171 water bodies in the 10 mi box, down to ~0.25 acre. **Not in this scope** (owner chose imagery over a water data layer) but confirmed viable for later                                            |
| Regrid                              | Paid nationwide parcels with owner names                                                                                                                                                   | Self-serve plan includes 2,000 records + 200,000 tiles/month; base price only visible after sign-up. **Not in this scope**                                                                              |

States with no confirmed free owner-bearing statewide service as of this research: Kansas (county by county), Iowa (statewide layer behind registration, owner field unconfirmed), South Dakota, Wyoming, Missouri. They are simply "uncovered" in v1.

---

## Sub-projects and sequencing

This spec is one document but three independently shippable sub-projects, each with its own implementation plan. Build in this order:

1. **Aerial imagery basemap toggle** — smallest, no server work, delivers the water-scouting value immediately.
2. **Parcel layer** — the bulk of the new architecture (provider registry, bbox route, viewport fetching, popups).
3. **Public land layer** — reuses everything sub-project 2 built; adds two providers and a legend section.

**Sequencing against existing work:** all three touch `MapView.svelte` and `+page.svelte`, as does the queued audit tranche 2a (overlay hardening). Do 2a first, then this work, then the tranche 3 UI redesign so the redesign sees the final set of layers.

---

## Shared layer architecture

Every new layer follows one pattern:

```text
+page.svelte            owns on/off + basemap state, persists to localStorage,
   │                    passes state down as props
   ▼
MapView.svelte          wires layer modules to the Leaflet map; adds no new
   │                    layer logic of its own
   ▼
src/lib/map/<layer>.ts  one module per layer; owns its Leaflet objects and
   │                    (for data layers) its fetch lifecycle
   ▼
/api/<layer>?bbox=…     thin SvelteKit route (data layers only)
   │
   ▼
src/lib/server/<layer>/ provider registry + one adapter per upstream source
```

### Client layer module contract

Each file in `src/lib/map/` exports a factory that takes the Leaflet namespace and the map and returns an object with:

- `setVisible(visible: boolean)` — add/remove from map, start/stop fetching.
- `destroy()` — remove layers and listeners; called from MapView's existing cleanup list.
- For data layers, an `onError(message: string)` callback supplied at construction so failures surface through the existing `errorMessage` toast, and an `onStatus(hint: string | null)` callback for non-error hints ("Zoom in to see property lines").

MapView creates each module once when the map is ready, forwards prop changes to `setVisible`, and registers `destroy` in `cleanupFns`. This is a deliberate, targeted improvement: `MapView.svelte` is already 355 lines with every existing layer inline, and it must not absorb three more.

### Server provider contract (data layers)

```ts
interface LayerProvider<T> {
  id: string;                       // 'ne-parcels', 'co-parcels', 'padus', 'ne-ofw'
  extent: LatLonBbox;               // rough coverage rectangle
  fetch(bbox: LatLonBbox, signal: AbortSignal): Promise<GeoJSON.FeatureCollection<Polygon | MultiPolygon, T>>;
}
```

A registry per layer selects every provider whose `extent` intersects the requested bbox, runs them concurrently, and merges the results. A bbox straddling a state line therefore returns both states' parcels. If no provider intersects, the route still succeeds with an empty collection and `meta.uncovered = true`.

A shared helper, `src/lib/server/arcgis.ts`, speaks the ArcGIS REST `query` protocol used by every upstream in this spec: builds the envelope query (`inSR=4326`, `outSR=4326`, `f=geojson`, `geometryPrecision=6`), follows `exceededTransferLimit` pagination via `resultOffset` up to a hard page cap, and applies `AbortSignal.timeout`. Adapters only supply the service URL, the `outFields` list, and a normalization function from raw attributes to the layer's record type.

### Route contract (data layers)

`GET /api/parcels?bbox=west,south,east,north` and `GET /api/public-land?bbox=west,south,east,north`.

- Parses and validates the bbox: four finite numbers, `west < east`, `south < north`, within world bounds.
- Rejects with 400 if the bbox exceeds `LAYER_MAX_BBOX_DEG` (0.5° in either axis — roughly 35 mi). The client's zoom threshold means a well-behaved client never hits this; it is a guard against abuse and bugs, not a UX path.
- Returns a GeoJSON `FeatureCollection` whose `properties` are the normalized record, plus a top-level `meta` object: `{ providers: string[], uncovered: boolean, truncated: boolean }`. `truncated` is true if any provider hit the page cap.
- Upstream timeout or failure from **one** provider does not fail the whole response when another succeeded; the failed provider is omitted from `meta.providers` and listed in `meta.failed`. If **all** intersecting providers fail, the route returns 502 with the layer's user-facing message.

### Timeouts and error classification

- `LAYER_TIMEOUT_MS = 15_000` per upstream request. These are small vector queries measured at under a second, not multi-MB raster downloads, so they get a much tighter budget than `CDL_TIMEOUT_MS`.
- Reuse the timeout classification already in `src/lib/server/cdl.ts` (`isTimeoutError` — matches `TimeoutError`/`AbortError` and undici `UND_ERR_*_TIMEOUT` codes on `err.cause`). Extract it to a shared module rather than duplicating it.

### Client fetch lifecycle (data layers)

- Fetch only while the layer is visible **and** `map.getZoom() >= LAYER_MIN_ZOOM` (13). Below that, call `onStatus('Zoom in to see property lines')` (or the public-land equivalent) and draw nothing new.
- Trigger on `moveend` (Leaflet fires this after pan and zoom), debounced 250 ms. Cancel any in-flight request with an `AbortController` before issuing a new one.
- Request the current map viewport bounds padded by 10% so small pans do not immediately refetch.
- Keep features in a `Map<string, Layer>` keyed by `provider + ':' + id`. Add only features not already present; never clear the layer on pan. Clear everything on `setVisible(false)`.
- Surface `meta.uncovered` via `onStatus('Property lines not available here yet')` and `meta.failed` (when some but not all providers failed) via `onError` once, not per pan — track the last error string and suppress repeats until it changes.

---

## Sub-project 1: Aerial imagery basemap toggle

**Data.** `src/lib/basemaps.ts` exports a constant list:

| id       | Tiles                                                                                              | Attribution                                    | Notes                                                                     |
| -------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| `street` | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` (existing)                                    | © OpenStreetMap contributors                   | Default                                                                   |
| `aerial` | `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}` | USGS, USDA — The National Map: Orthoimagery    | `maxNativeZoom: 16`, `maxZoom` matches the map so Leaflet upscales past 16 |

**Client.** `src/lib/map/basemap.ts` creates both tile layers once, adds the selected one, and swaps on change. Tile layers sit at Leaflet's default tile pane, so the CDL image overlay, bbox rectangle, and markers stay above them without z-index changes.

**UI.** A new sidebar component `MapLayers.svelte` placed below Crop Types, containing a Street / Aerial radio pair (this sub-project) and, later, the two layer checkboxes. State `basemap: 'street' | 'aerial'` lives in `+page.svelte`, persisted via `saveBasemap` / `getBasemap` in `localStorage.ts` under key `ff-basemap`.

**Out of scope.** No opacity blending between basemaps. No NAIP Plus dynamic export (measured at ~9 s per image; unusable as a basemap).

**Tests.** `basemaps.spec.ts` asserts both entries exist with the expected ids and that the aerial URL uses the `{z}/{y}/{x}` order. `localStorage.spec.ts` gains round-trip coverage for the basemap key. Live check: switch to Aerial at the test location, tiles render, zero console errors.

---

## Sub-project 2: Parcel layer

### Normalized record

```ts
interface Parcel {
  id: string;                 // provider's parcel id
  provider: string;           // 'ne-parcels' | 'co-parcels'
  state: 'NE' | 'CO';
  county: string | null;
  owner: string | null;       // null when the source does not publish it
  ownerAddress: string | null;
  situsAddress: string | null;
  legalDescription: string | null;
  acres: number | null;
  irrigation: string | null;  // NE only; null elsewhere
  lookupUrl: string | null;   // county record URL when the source provides one
}
```

### Providers

**Nebraska** (`src/lib/server/parcels/nebraska.ts`)
Service: `https://gis.ne.gov/Enterprise/rest/services/StatewideParcelsExternal/FeatureServer/0`.
`outFields`: `Parcel_ID, Situs_Address, Legal_Description, GIS_Acres, Irrigation_Type, County_ID, Parcel_URL`.
Mapping: `owner = null`, `ownerAddress = null`, `situsAddress` from `Situs_Address` unless it is empty or just `"NE"` (observed placeholder), `lookupUrl` from `Parcel_URL` when non-empty else `null`. `county` from `County_ID` mapped through a small FIPS→name table for Nebraska's 93 counties (`src/lib/server/parcels/neCounties.ts`).

**Colorado** (`src/lib/server/parcels/colorado.ts`)
Service: `https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0`.
`outFields`: `parcel_id, owner, owner2, ownerAdd, ownAddCty, ownAddStt, ownAddZip, situsAdd, legalDesc, landAcres, countyName, URL`.
Mapping: `owner` joins `owner` and `owner2` with `" & "` when both present; `ownerAddress` joins the four address parts; `lookupUrl` from `URL`.

**Extents.** Rough state rectangles in `src/lib/server/parcels/index.ts`: NE `[-104.06, 40.0, -95.31, 43.0]`, CO `[-109.06, 36.99, -102.04, 41.0]`. Overlap at the NE/CO border is intentional.

### Client

`src/lib/map/parcelLayer.ts` implements the shared fetch lifecycle above against `/api/parcels`.

- **Style:** stroke `#1f2937` (gray-800), weight 1, opacity 0.8, fill opacity 0. Parcels must not obscure the CDL overlay or the aerial imagery beneath them.
- **Hover:** weight 2.5. Reset on mouseout.
- **Click popup**, in this order:
  1. Owner name (bold) when present; otherwise the line _"Owner not published by this state"_.
  2. Owner mailing address when present.
  3. Acres, formatted to one decimal, with the situs address or, if absent, the legal description.
  4. County and state.
  5. Irrigation type when present.
  6. A link: the parcel's `lookupUrl` labelled _"View county record"_ when present; otherwise, for Nebraska, a link to the Nebraska Department of Revenue county assessor directory (`https://revenue.nebraska.gov/PAD/county-assessors-and-parcel-search`) labelled _"Look up owner at county assessor"_. Both open in a new tab.

### UI

A **Property Lines** checkbox in `MapLayers.svelte`. State `showParcels: boolean` in `+page.svelte`, persisted under `ff-show-parcels`. Default off.

Hints and the "not available here yet" message render in the existing bottom-left hint area beside the legend, replacing the current hint text while active.

### Explicitly not built

- No Regrid or other paid adapter. The provider interface is where one would go.
- No server-side cache. Upstreams answered in under a second and the data refreshes yearly; an in-memory TTL cache is an easy follow-up if the state services prove flaky.
- No parcel search by owner name, no parcel-to-crop statistics, no "highlight parcels growing X." Those are future ideas that depend on this layer existing.
- No states beyond NE and CO.

### Tests

- `arcgis.spec.ts`: builds the expected query URL from a bbox; follows pagination when `exceededTransferLimit` is set; stops at the page cap and reports truncation; classifies a timeout.
- `nebraska.spec.ts`, `colorado.spec.ts`: normalize a recorded upstream feature (captured during research) into a `Parcel`; Nebraska yields `owner: null` and treats `"NE"` situs as absent; Colorado joins `owner`/`owner2`.
- `parcels/index.spec.ts`: registry selects NE only, CO only, both (border bbox), and none (Kansas bbox → `uncovered: true`); one provider failing while another succeeds yields a 200 with `meta.failed`.
- `api/parcels/server.spec.ts`: bbox parsing rejects malformed input, inverted bounds, and oversized boxes with 400.
- `localStorage.spec.ts`: round-trip for `ff-show-parcels`.
- Live (Playwright) at the test location, zoom 14, Property Lines on: parcels render; clicking the marker's parcel shows a ~473-acre Frontier County tract with "Owner not published by this state" and the assessor link; panning does not flicker existing parcels; zooming out below 13 shows the zoom hint.

---

## Sub-project 3: Public land layer

### Normalized record

```ts
type AccessClass = 'open' | 'restricted' | 'closed' | 'unknown';

interface PublicLand {
  id: string;
  provider: string;          // 'padus' | 'ne-ofw'
  program: string;           // 'PAD-US' | 'Nebraska Open Fields and Waters'
  name: string | null;       // unit name
  manager: string | null;    // managing agency
  access: AccessClass;
}
```

### Providers

**PAD-US** (`src/lib/server/publicLand/padus.ts`)
Service: `https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Fee_Managers_PADUS/FeatureServer/0`.
`outFields`: `Unit_Nm, Mang_Name, Own_Name, Pub_Access`.
Access mapping: `OA → open`, `RA → restricted`, `XA → closed`, anything else → `unknown`. Extent: continental US.

**Nebraska Open Fields and Waters** (`src/lib/server/publicLand/nebraskaOfw.ts`)
Service: the current season's layer under `https://services5.arcgis.com/IOshH1zLrIieqrNk/arcgis/rest/services/` (at research time `OFW_2026_2027_QA_Web_Map_View/FeatureServer/0`). The season-specific service name lives in one constant, `NE_OFW_SERVICE`, in `src/lib/constants.ts` beside `CDL_MAX_YEAR`, because it changes every year exactly the way the CDL year does.
`outFields`: `ContractNumber2, County, ContractAcres`.
Mapping: `name` = `"Open Fields & Waters tract"` plus county, `manager` = `"Nebraska Game and Parks Commission"`, `access = 'open'`. Extent: Nebraska.

### Client

`src/lib/map/publicLandLayer.ts`, same lifecycle as parcels against `/api/public-land`.

- **Style** by access class, fill opacity 0.25, stroke weight 1 in the same hue:

  | Access     | Fill      |
  | ---------- | --------- |
  | open       | `#16a34a` (green-600)  |
  | restricted | `#f59e0b` (amber-500)  |
  | closed     | `#dc2626` (red-600)    |
  | unknown    | `#6b7280` (gray-500)   |

- **Click popup:** unit name, managing agency, access class in words ("Open to the public", "Restricted access", "Closed to the public", "Access unknown"), and the program it came from.
- **Legend:** while the layer is visible, `Legend.svelte` shows a "Public Land" group with the four swatches above. Swatches and layer style must read from the same constant so they cannot drift — the same rule the crop swatches already follow.

### UI

A **Public Land** checkbox in `MapLayers.svelte`. State `showPublicLand: boolean` in `+page.svelte`, persisted under `ff-show-public-land`. Default off.

### Explicitly not built

- No Kansas WIHA, no other state walk-in programs. KDWP publishes theirs as an ArcGIS feature service too, so it is one more adapter when wanted.
- No filtering by access class.

### Tests

- `padus.spec.ts`: each access code maps correctly; unknown codes map to `unknown`.
- `nebraskaOfw.spec.ts`: normalizes a recorded feature; access is always `open`.
- `publicLand/index.spec.ts`: registry returns PAD-US alone outside Nebraska and both inside.
- `Legend` test: public-land swatches appear only when the layer is on and use the shared constant.
- Live at the test location, zoom 12, Public Land on: Darr Strip Wildlife Management Area renders green; clicking it names the unit and "Nebraska Game and Parks"; at least one Open Fields tract renders within the 25 mi box.

---

## Error handling summary

| Situation                                   | Behaviour                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Zoom below threshold with a data layer on   | Hint "Zoom in to see property lines" / "…public land"; no fetch                                |
| Viewport outside every provider's extent    | Hint "Property lines not available here yet"; no toast                                         |
| One provider fails, another succeeds        | Draw what succeeded; one toast naming the layer; suppress repeats until the error changes      |
| Every intersecting provider fails           | 502 from the route; toast "Property lines unavailable right now" (or public-land equivalent); already-drawn features stay |
| Upstream hangs                              | 15 s timeout, classified as a timeout, same toast as above                                     |
| Aerial tiles fail to load                   | Leaflet shows blank tiles; no toast (tile errors are per-tile and transient)                   |
| Malformed or oversized bbox                 | 400; treated as a client bug, not surfaced to the user beyond the generic toast                |

---

## Open questions carried into planning

- Whether `Legend.svelte`'s current collapsible grid can host a second group without restructuring, or whether the public-land swatches should be a sibling panel. Decide in the sub-project 3 plan.
- The exact debounce and padding values (250 ms, 10%) are starting points to tune during live verification.

---

## Sources

- Nebraska Statewide Parcels — https://gis.ne.gov/Enterprise/rest/services/StatewideParcelsExternal/FeatureServer/0 (listed on https://www.nebraskamap.gov/)
- Colorado Public Parcels — https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0
- USGS Imagery Only tiles — https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer
- PAD-US Fee Managers — https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Fee_Managers_PADUS/FeatureServer
- Nebraska Game and Parks Open Fields and Waters — https://services5.arcgis.com/IOshH1zLrIieqrNk/arcgis/rest/services/ and https://outdoornebraska.gov/guides-maps/public-access-atlas/
- USGS NHDPlus HR (future water layer) — https://hydro.nationalmap.gov/arcgis/rest/services/NHDPlus_HR/MapServer
- Regrid self-serve plans (future paid fallback) — https://support.regrid.com/changelog/self-serve-api-plans
