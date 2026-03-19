# Field Finder — Initial Webapp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core Field Finder webapp — a collapsible sidebar with search/filter controls alongside a Leaflet map that displays USDA crop data overlays.

**Architecture:** SvelteKit single-page app. Left sidebar holds all controls (search bar, radius slider, year dropdown, crop checkboxes, search button). Leaflet map fills the remaining viewport. Server-side API routes proxy CDL and Nominatim requests to avoid CORS. All user preferences persist in localStorage.

**Tech Stack:** SvelteKit 2 (Svelte 5 runes), TypeScript, Tailwind CSS 4, Leaflet.js, proj4js, Vitest

**Spec:** `docs/superpowers/specs/2026-03-17-initial-webapp-design.md`

---

## File Structure

```
src/
├── lib/
│   ├── crops.ts                    # Crop metadata: CDL IDs, names, colors (single source of truth)
│   ├── geo.ts                      # Pure lat/lon bbox math (shared between client & server)
│   ├── localStorage.ts             # Read/write helpers for persisted user preferences
│   ├── components/
│   │   ├── Sidebar.svelte          # Collapsible sidebar container
│   │   ├── SearchBar.svelte        # Address autocomplete + lat/lon parsing
│   │   ├── RadiusSlider.svelte     # Range input with warning text
│   │   ├── YearSelector.svelte     # Year dropdown
│   │   ├── CropFilter.svelte       # Checkboxes with color swatches
│   │   ├── SearchButton.svelte     # Triggers search, disabled during loading
│   │   ├── MapView.svelte          # Leaflet map wrapper (includes waypoint logic)
│   │   └── Legend.svelte           # Floating color legend (Leaflet control)
│   └── server/
│       ├── coordinates.ts          # EPSG:5070 projection + bbox (imports geo.ts for lat/lon math)
│       ├── cdl.ts                  # CDL API client (GetCDLFile, ExtractCDLByValues, GetCDLImage)
│       └── geocode.ts              # Nominatim proxy with rate limiting
├── routes/
│   ├── +layout.svelte              # (existing — add Leaflet CSS import)
│   ├── +page.svelte                # Top-level layout: sidebar + map split
│   ├── api/
│   │   ├── search/+server.ts       # POST /api/search — CDL proxy endpoint
│   │   └── geocode/+server.ts      # GET /api/geocode — Nominatim proxy endpoint
│   └── layout.css                  # (existing — already imports tailwindcss)
```

---

## Task 1: Install Dependencies & Configure Leaflet

**Files:**
- Modify: `package.json`
- Modify: `src/app.html`

New npm dependencies needed:
- `leaflet` — map library
- `@types/leaflet` — TypeScript types (devDep)
- `proj4` — coordinate projection EPSG:4326↔5070
- `@types/proj4` — TypeScript types (devDep)

- [ ] **Step 1: Install packages**

```bash
npm install leaflet proj4
npm install -D @types/leaflet @types/proj4
```

- [ ] **Step 2: Add Leaflet CSS to app.html**

Add the Leaflet CSS CDN link to `src/app.html` inside the `<head>` tag, before `%sveltekit.head%`:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
  crossorigin="" />
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev -- --open
```

Expected: SvelteKit dev server starts without errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/app.html
git commit -m "feat: install leaflet and proj4 dependencies"
```

---

## Task 2: Crop Configuration — Single Source of Truth

**Files:**
- Create: `src/lib/crops.ts`
- Create: `src/lib/crops.spec.ts`

This module defines all crop metadata used by `CropFilter`, `Legend`, and future `AreaSummary`. Every component reads from this one file.

- [ ] **Step 1: Write the test**

```ts
// src/lib/crops.spec.ts
import { describe, it, expect } from 'vitest';
import { CROPS, getCropById, getAllCrops } from './crops';

describe('crops config', () => {
	it('exports a CROPS object with known crop entries', () => {
		expect(CROPS.sorghum).toEqual({ id: 4, name: 'Sorghum', color: '#FF8C00' });
		expect(CROPS.openWater).toEqual({ id: 111, name: 'Open Water', color: '#4169E1' });
	});

	it('every crop has id, name, and color', () => {
		for (const [key, crop] of Object.entries(CROPS)) {
			expect(crop.id, `${key} missing id`).toBeTypeOf('number');
			expect(crop.name, `${key} missing name`).toBeTypeOf('string');
			expect(crop.color, `${key} missing color`).toMatch(/^#[0-9A-Fa-f]{6}$/);
		}
	});

	it('has no duplicate CDL IDs', () => {
		const ids = Object.values(CROPS).map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('getCropById returns the correct crop', () => {
		expect(getCropById(4)).toEqual({ id: 4, name: 'Sorghum', color: '#FF8C00' });
	});

	it('getCropById returns undefined for unknown ID', () => {
		expect(getCropById(9999)).toBeUndefined();
	});

	it('getAllCrops returns an array of all crops with their keys', () => {
		const all = getAllCrops();
		expect(all.length).toBe(Object.keys(CROPS).length);
		expect(all[0]).toHaveProperty('key');
		expect(all[0]).toHaveProperty('id');
		expect(all[0]).toHaveProperty('name');
		expect(all[0]).toHaveProperty('color');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/crops.spec.ts
```

Expected: FAIL — module `./crops` does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/crops.ts
export const CROPS = {
	sorghum: { id: 4, name: 'Sorghum', color: '#FF8C00' },
	winterWheat: { id: 24, name: 'Winter Wheat', color: '#8B4513' },
	springWheat: { id: 23, name: 'Spring Wheat', color: '#D2B48C' },
	corn: { id: 1, name: 'Corn', color: '#FFFF00' },
	soybeans: { id: 5, name: 'Soybeans', color: '#008000' },
	sunflower: { id: 6, name: 'Sunflower', color: '#DAA520' },
	oats: { id: 28, name: 'Oats', color: '#800080' },
	barley: { id: 21, name: 'Barley', color: '#FF00FF' },
	alfalfa: { id: 36, name: 'Alfalfa', color: '#FFC0CB' },
	pasture: { id: 176, name: 'Pasture/Grass', color: '#90EE90' },
	fallow: { id: 61, name: 'Fallow/Idle', color: '#808080' },
	openWater: { id: 111, name: 'Open Water', color: '#4169E1' },
	wetlands: { id: 190, name: 'Wetlands/Rivers', color: '#ADD8E6' }
} as const;

export type CropKey = keyof typeof CROPS;
export type CropEntry = (typeof CROPS)[CropKey];

/** Look up a crop by its CDL numeric ID. */
export function getCropById(id: number): CropEntry | undefined {
	return Object.values(CROPS).find((c) => c.id === id);
}

/** Return all crops as an array with their config key included. */
export function getAllCrops(): Array<{ key: CropKey } & CropEntry> {
	return Object.entries(CROPS).map(([key, crop]) => ({
		key: key as CropKey,
		...crop
	}));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/crops.spec.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/crops.ts src/lib/crops.spec.ts
git commit -m "feat: add crop configuration with CDL IDs, names, and colors"
```

---

## Task 3: localStorage Persistence Helpers

**Files:**
- Create: `src/lib/localStorage.ts`
- Create: `src/lib/localStorage.spec.ts`

Centralizes all localStorage reads/writes. Handles SSR safety (localStorage unavailable on server).

- [ ] **Step 1: Write the test**

```ts
// src/lib/localStorage.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
	saveLastLocation,
	getLastLocation,
	saveLastRadius,
	getLastRadius,
	saveCropFilters,
	getCropFilters,
	saveSidebarCollapsed,
	getSidebarCollapsed,
	saveWaypoints,
	getWaypoints,
	type Waypoint
} from './localStorage';

// Mock localStorage for Node test environment
const store: Record<string, string> = {};
const mockLocalStorage = {
	getItem: (key: string) => store[key] ?? null,
	setItem: (key: string, val: string) => {
		store[key] = val;
	},
	removeItem: (key: string) => {
		delete store[key];
	}
} as Storage;

beforeEach(() => {
	Object.keys(store).forEach((k) => delete store[k]);
});

describe('localStorage helpers', () => {
	it('saves and retrieves last location', () => {
		saveLastLocation({ lat: 40.554, lon: -100.076 }, mockLocalStorage);
		expect(getLastLocation(mockLocalStorage)).toEqual({ lat: 40.554, lon: -100.076 });
	});

	it('returns null when no location is saved', () => {
		expect(getLastLocation(mockLocalStorage)).toBeNull();
	});

	it('saves and retrieves last radius', () => {
		saveLastRadius(15, mockLocalStorage);
		expect(getLastRadius(mockLocalStorage)).toBe(15);
	});

	it('returns null when no radius is saved', () => {
		expect(getLastRadius(mockLocalStorage)).toBeNull();
	});

	it('saves and retrieves crop filter state', () => {
		const filters = { sorghum: true, corn: false, wheat: true };
		saveCropFilters(filters, mockLocalStorage);
		expect(getCropFilters(mockLocalStorage)).toEqual(filters);
	});

	it('returns null when no crop filters saved', () => {
		expect(getCropFilters(mockLocalStorage)).toBeNull();
	});

	it('saves and retrieves sidebar collapsed state', () => {
		saveSidebarCollapsed(true, mockLocalStorage);
		expect(getSidebarCollapsed(mockLocalStorage)).toBe(true);
	});

	it('saves and retrieves waypoints', () => {
		const waypoints: Waypoint[] = [
			{ lat: 40.5, lon: -100.1 },
			{ lat: 40.6, lon: -100.2, name: 'Good milo field' }
		];
		saveWaypoints(waypoints, mockLocalStorage);
		expect(getWaypoints(mockLocalStorage)).toEqual(waypoints);
	});

	it('returns empty array when no waypoints saved', () => {
		expect(getWaypoints(mockLocalStorage)).toEqual([]);
	});

	it('handles corrupted JSON gracefully', () => {
		store['ff-last-location'] = '{not valid json';
		expect(getLastLocation(mockLocalStorage)).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/localStorage.spec.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/localStorage.ts

export interface Waypoint {
	lat: number;
	lon: number;
	name?: string;
}

const KEYS = {
	location: 'ff-last-location',
	radius: 'ff-last-radius',
	crops: 'ff-crop-filters',
	sidebar: 'ff-sidebar-collapsed',
	waypoints: 'ff-waypoints'
} as const;

function safeGet<T>(key: string, storage?: Storage): T | null {
	try {
		const raw = storage?.getItem(key);
		if (raw === null || raw === undefined) return null;
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

function safeSet(key: string, value: unknown, storage?: Storage): void {
	try {
		storage?.setItem(key, JSON.stringify(value));
	} catch {
		// localStorage full or unavailable — silently fail
	}
}

// Location
export function saveLastLocation(
	loc: { lat: number; lon: number },
	storage?: Storage
): void {
	safeSet(KEYS.location, loc, storage);
}
export function getLastLocation(
	storage?: Storage
): { lat: number; lon: number } | null {
	return safeGet(KEYS.location, storage);
}

// Radius
export function saveLastRadius(radius: number, storage?: Storage): void {
	safeSet(KEYS.radius, radius, storage);
}
export function getLastRadius(storage?: Storage): number | null {
	return safeGet(KEYS.radius, storage);
}

// Crop filters
export function saveCropFilters(
	filters: Record<string, boolean>,
	storage?: Storage
): void {
	safeSet(KEYS.crops, filters, storage);
}
export function getCropFilters(
	storage?: Storage
): Record<string, boolean> | null {
	return safeGet(KEYS.crops, storage);
}

// Sidebar
export function saveSidebarCollapsed(
	collapsed: boolean,
	storage?: Storage
): void {
	safeSet(KEYS.sidebar, collapsed, storage);
}
export function getSidebarCollapsed(storage?: Storage): boolean | null {
	return safeGet(KEYS.sidebar, storage);
}

// Waypoints
export function saveWaypoints(waypoints: Waypoint[], storage?: Storage): void {
	safeSet(KEYS.waypoints, waypoints, storage);
}
export function getWaypoints(storage?: Storage): Waypoint[] {
	return safeGet<Waypoint[]>(KEYS.waypoints, storage) ?? [];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/localStorage.spec.ts
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/localStorage.ts src/lib/localStorage.spec.ts
git commit -m "feat: add localStorage persistence helpers for user preferences"
```

---

## Task 4: Coordinate Projection & Bounding Box Math

**Files:**
- Create: `src/lib/geo.ts` — pure lat/lon bbox math (no proj4, shared with client)
- Create: `src/lib/geo.spec.ts`
- Create: `src/lib/server/coordinates.ts` — projection (proj4, server-only)
- Create: `src/lib/server/coordinates.spec.ts`

The lat/lon bbox function (`computeBboxLatLon`) lives in `src/lib/geo.ts` so the client (MapView) can import it to draw the bounding box rectangle without pulling in proj4. The server `coordinates.ts` re-exports it and adds Albers projection.

The algorithm (matching `ff.py`):
1. Compute bbox in lat/lon: `lat ± (miles / 69.0)`, `lon ± (miles / (69.0 * cos(radians(lat))))`
2. Project the four corners from EPSG:4326 → EPSG:5070 using proj4
3. Return both the EPSG:5070 bbox (for CDL API) and the EPSG:4326 bbox (for Leaflet)

- [ ] **Step 1: Write the test**

```ts
// src/lib/server/coordinates.spec.ts
import { describe, it, expect } from 'vitest';
import {
	computeBboxLatLon,
	projectToAlbers,
	projectToLatLon,
	computeSearchBbox
} from './coordinates';

describe('computeBboxLatLon', () => {
	it('computes a bounding box from center + radius in miles', () => {
		const bbox = computeBboxLatLon(40.554, -100.076, 10);
		// 10 miles / 69.0 ≈ 0.1449 degrees latitude
		expect(bbox.south).toBeCloseTo(40.554 - 10 / 69.0, 3);
		expect(bbox.north).toBeCloseTo(40.554 + 10 / 69.0, 3);
		// longitude degrees are wider at this latitude
		const lonDelta = 10 / (69.0 * Math.cos((40.554 * Math.PI) / 180));
		expect(bbox.west).toBeCloseTo(-100.076 - lonDelta, 3);
		expect(bbox.east).toBeCloseTo(-100.076 + lonDelta, 3);
	});
});

describe('projectToAlbers', () => {
	it('projects EPSG:4326 to EPSG:5070', () => {
		const [x, y] = projectToAlbers(-100.076, 40.554);
		// Expected approximate values for this location (central Nebraska)
		// EPSG:5070 coordinates are in meters, typically large values
		expect(x).toBeTypeOf('number');
		expect(y).toBeTypeOf('number');
		// Sanity check: x should be negative (west of center), y positive
		// For central US in Albers: x ~ -300,000 to 300,000, y ~ 1,500,000 to 2,500,000
		expect(Math.abs(x)).toBeLessThan(3_000_000);
		expect(y).toBeGreaterThan(0);
	});
});

describe('projectToLatLon', () => {
	it('round-trips a projection', () => {
		const [x, y] = projectToAlbers(-100.076, 40.554);
		const [lon, lat] = projectToLatLon(x, y);
		expect(lon).toBeCloseTo(-100.076, 4);
		expect(lat).toBeCloseTo(40.554, 4);
	});
});

describe('computeSearchBbox', () => {
	it('returns both Albers and lat/lon bounding boxes', () => {
		const result = computeSearchBbox(40.554, -100.076, 10);

		// Albers bbox for CDL API
		expect(result.albers).toHaveProperty('xMin');
		expect(result.albers).toHaveProperty('yMin');
		expect(result.albers).toHaveProperty('xMax');
		expect(result.albers).toHaveProperty('yMax');
		expect(result.albers.xMin).toBeLessThan(result.albers.xMax);
		expect(result.albers.yMin).toBeLessThan(result.albers.yMax);

		// Lat/lon bbox for Leaflet overlay
		expect(result.latLon).toHaveProperty('south');
		expect(result.latLon).toHaveProperty('north');
		expect(result.latLon.south).toBeCloseTo(40.554 - 10 / 69.0, 3);
	});

	it('produces a larger box for a larger radius', () => {
		const small = computeSearchBbox(40.554, -100.076, 5);
		const large = computeSearchBbox(40.554, -100.076, 15);
		const smallWidth = small.albers.xMax - small.albers.xMin;
		const largeWidth = large.albers.xMax - large.albers.xMin;
		expect(largeWidth).toBeGreaterThan(smallWidth);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/server/coordinates.spec.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the shared geo module**

```ts
// src/lib/geo.ts
// Pure lat/lon math — no proj4, safe to import on client and server.

export interface LatLonBbox {
	south: number;
	north: number;
	west: number;
	east: number;
}

/**
 * Compute a bounding box in lat/lon from a center point and radius in miles.
 * Uses the simple degrees-per-mile approximation from ff.py.
 */
export function computeBboxLatLon(lat: number, lon: number, radiusMiles: number): LatLonBbox {
	const latDelta = radiusMiles / 69.0;
	const lonDelta = radiusMiles / (69.0 * Math.cos((lat * Math.PI) / 180));

	return {
		south: lat - latDelta,
		north: lat + latDelta,
		west: lon - lonDelta,
		east: lon + lonDelta
	};
}
```

- [ ] **Step 4: Write the server coordinates module**

```ts
// src/lib/server/coordinates.ts
import proj4 from 'proj4';
export { computeBboxLatLon, type LatLonBbox } from '$lib/geo';

// Define EPSG:5070 (Albers Equal Area Conic for CONUS)
const EPSG_5070 =
	'+proj=aea +lat_0=23 +lon_0=-96 +lat_1=29.5 +lat_2=45.5 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs';
const EPSG_4326 = 'EPSG:4326'; // WGS84 lat/lon

export interface AlbersBbox {
	xMin: number;
	yMin: number;
	xMax: number;
	yMax: number;
}

/** Project a single point from EPSG:4326 (lon, lat) to EPSG:5070 (x, y). */
export function projectToAlbers(lon: number, lat: number): [number, number] {
	return proj4(EPSG_4326, EPSG_5070, [lon, lat]) as [number, number];
}

/** Project a single point from EPSG:5070 (x, y) to EPSG:4326 (lon, lat). */
export function projectToLatLon(x: number, y: number): [number, number] {
	return proj4(EPSG_5070, EPSG_4326, [x, y]) as [number, number];
}

/**
 * Compute both Albers (for CDL API) and lat/lon (for Leaflet) bounding boxes.
 * Algorithm: compute bbox in lat/lon, then project corners to Albers.
 */
export function computeSearchBbox(
	lat: number,
	lon: number,
	radiusMiles: number
): { albers: AlbersBbox; latLon: LatLonBbox } {
	const latLon = computeBboxLatLon(lat, lon, radiusMiles);

	// Project the four corners to Albers
	const sw = projectToAlbers(latLon.west, latLon.south);
	const ne = projectToAlbers(latLon.east, latLon.north);
	const nw = projectToAlbers(latLon.west, latLon.north);
	const se = projectToAlbers(latLon.east, latLon.south);

	// Use min/max of all four corners to get the Albers bbox
	// (necessary because Albers projection can rotate the rectangle slightly)
	const xs = [sw[0], ne[0], nw[0], se[0]];
	const ys = [sw[1], ne[1], nw[1], se[1]];

	return {
		albers: {
			xMin: Math.min(...xs),
			yMin: Math.min(...ys),
			xMax: Math.max(...xs),
			yMax: Math.max(...ys)
		},
		latLon
	};
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/lib/server/coordinates.spec.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/geo.ts src/lib/server/coordinates.ts src/lib/server/coordinates.spec.ts
git commit -m "feat: add coordinate projection and bounding box math"
```

---

## Task 5: CDL API Client

**Files:**
- Create: `src/lib/server/cdl.ts`
- Create: `src/lib/server/cdl.spec.ts`

Handles the three-step CDL API call chain: GetCDLFile → ExtractCDLByValues → GetCDLImage. Each step returns XML that must be parsed for a URL.

CDL API base URL: `https://nassgeodata.gmu.edu/axis2/services/CDLService`

- [ ] **Step 1: Write the test**

```ts
// src/lib/server/cdl.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { parseReturnUrl, buildCdlFileUrl, buildExtractUrl, buildImageUrl, fetchCdlData } from './cdl';

describe('URL builders', () => {
	it('buildCdlFileUrl constructs correct URL with bbox', () => {
		const url = buildCdlFileUrl(2024, {
			xMin: -300000,
			yMin: 1800000,
			xMax: -280000,
			yMax: 1820000
		});
		expect(url).toContain('GetCDLFile');
		expect(url).toContain('year=2024');
		expect(url).toContain('bbox=-300000,1800000,-280000,1820000');
	});

	it('buildExtractUrl constructs correct URL with crop values', () => {
		const url = buildExtractUrl('https://example.com/raster.tif', [4, 24, 6]);
		expect(url).toContain('ExtractCDLByValues');
		expect(url).toContain('values=4,24,6');
	});

	it('buildImageUrl constructs correct URL', () => {
		const url = buildImageUrl('https://example.com/raster.tif');
		expect(url).toContain('GetCDLImage');
		expect(url).toContain('format=png');
	});
});

describe('parseReturnUrl', () => {
	it('extracts returnURL from CDL XML response', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ns1:GetCDLFileResponse xmlns:ns1="CDLService">
  <returnURL>https://nassgeodata.gmu.edu/results/raster.tif</returnURL>
</ns1:GetCDLFileResponse>`;
		expect(parseReturnUrl(xml)).toBe('https://nassgeodata.gmu.edu/results/raster.tif');
	});

	it('throws on XML with no returnURL', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?><empty/>`;
		expect(() => parseReturnUrl(xml)).toThrow();
	});
});

describe('fetchCdlData', () => {
	it('calls the CDL API chain and returns a PNG URL', async () => {
		const mockFetch = vi.fn()
			// Step 1: GetCDLFile → returns raster URL
			.mockResolvedValueOnce({
				ok: true,
				text: async () =>
					`<r><returnURL>https://nassgeodata.gmu.edu/raster.tif</returnURL></r>`
			})
			// Step 2: ExtractCDLByValues → returns filtered raster URL
			.mockResolvedValueOnce({
				ok: true,
				text: async () =>
					`<r><returnURL>https://nassgeodata.gmu.edu/filtered.tif</returnURL></r>`
			})
			// Step 3: GetCDLImage → returns PNG URL
			.mockResolvedValueOnce({
				ok: true,
				text: async () =>
					`<r><returnURL>https://nassgeodata.gmu.edu/image.png</returnURL></r>`
			});

		const result = await fetchCdlData(
			{
				year: 2024,
				albers: { xMin: -300000, yMin: 1800000, xMax: -280000, yMax: 1820000 },
				crops: [4, 24]
			},
			mockFetch as unknown as typeof fetch
		);

		expect(result).toBe('https://nassgeodata.gmu.edu/image.png');
		expect(mockFetch).toHaveBeenCalledTimes(3);
	});

	it('skips ExtractCDLByValues when no crops filter provided', async () => {
		const mockFetch = vi.fn()
			.mockResolvedValueOnce({
				ok: true,
				text: async () =>
					`<r><returnURL>https://nassgeodata.gmu.edu/raster.tif</returnURL></r>`
			})
			.mockResolvedValueOnce({
				ok: true,
				text: async () =>
					`<r><returnURL>https://nassgeodata.gmu.edu/image.png</returnURL></r>`
			});

		const result = await fetchCdlData(
			{
				year: 2024,
				albers: { xMin: -300000, yMin: 1800000, xMax: -280000, yMax: 1820000 },
				crops: []
			},
			mockFetch as unknown as typeof fetch
		);

		expect(result).toBe('https://nassgeodata.gmu.edu/image.png');
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/server/cdl.spec.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/server/cdl.ts
import type { AlbersBbox } from './coordinates';

const CDL_BASE = 'https://nassgeodata.gmu.edu/axis2/services/CDLService';

export function buildCdlFileUrl(year: number, bbox: AlbersBbox): string {
	const bboxStr = `${bbox.xMin},${bbox.yMin},${bbox.xMax},${bbox.yMax}`;
	return `${CDL_BASE}/GetCDLFile?year=${year}&bbox=${bboxStr}`;
}

export function buildExtractUrl(rasterUrl: string, cropValues: number[]): string {
	return `${CDL_BASE}/ExtractCDLByValues?file=${encodeURIComponent(rasterUrl)}&values=${cropValues.join(',')}`;
}

export function buildImageUrl(rasterUrl: string): string {
	return `${CDL_BASE}/GetCDLImage?files=${encodeURIComponent(rasterUrl)}&format=png`;
}

/**
 * Parse the <returnURL> element from CDL API XML response.
 * The CDL API wraps results in various XML envelopes but always uses <returnURL>.
 */
export function parseReturnUrl(xml: string): string {
	const match = xml.match(/<returnURL>(.*?)<\/returnURL>/);
	if (!match) {
		throw new Error(`CDL API response missing <returnURL>: ${xml.slice(0, 200)}`);
	}
	return match[1];
}

export interface CdlRequest {
	year: number;
	albers: AlbersBbox;
	crops: number[];
}

/**
 * Execute the CDL API call chain:
 * 1. GetCDLFile → raster URL
 * 2. ExtractCDLByValues → filtered raster URL (if crops specified)
 * 3. GetCDLImage → PNG URL
 *
 * Accepts an optional fetch function for testing.
 */
export async function fetchCdlData(
	request: CdlRequest,
	fetchFn: typeof fetch = fetch
): Promise<string> {
	// Step 1: Get raster file
	const cdlFileUrl = buildCdlFileUrl(request.year, request.albers);
	const rasterResp = await fetchFn(cdlFileUrl);
	if (!rasterResp.ok) {
		throw new Error(`CDL GetCDLFile failed: ${rasterResp.status}`);
	}
	let rasterUrl = parseReturnUrl(await rasterResp.text());

	// Step 2: Filter by crop values (if any)
	if (request.crops.length > 0) {
		const extractUrl = buildExtractUrl(rasterUrl, request.crops);
		const extractResp = await fetchFn(extractUrl);
		if (!extractResp.ok) {
			throw new Error(`CDL ExtractCDLByValues failed: ${extractResp.status}`);
		}
		rasterUrl = parseReturnUrl(await extractResp.text());
	}

	// Step 3: Get PNG image
	const imageUrl = buildImageUrl(rasterUrl);
	const imageResp = await fetchFn(imageUrl);
	if (!imageResp.ok) {
		throw new Error(`CDL GetCDLImage failed: ${imageResp.status}`);
	}
	return parseReturnUrl(await imageResp.text());
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/server/cdl.spec.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/cdl.ts src/lib/server/cdl.spec.ts
git commit -m "feat: add CDL API client with three-step fetch chain"
```

---

## Task 6: Nominatim Geocoding Proxy

**Files:**
- Create: `src/lib/server/geocode.ts`
- Create: `src/lib/server/geocode.spec.ts`

Proxies Nominatim requests, enforces rate limiting (1 req/sec), and sends a proper User-Agent.

- [ ] **Step 1: Write the test**

```ts
// src/lib/server/geocode.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { geocode, buildNominatimUrl, parseNominatimResults } from './geocode';

describe('buildNominatimUrl', () => {
	it('constructs a Nominatim search URL', () => {
		const url = buildNominatimUrl('Eustis, NE');
		expect(url).toContain('nominatim.openstreetmap.org/search');
		expect(url).toContain('q=Eustis%2C+NE');
		expect(url).toContain('format=json');
		expect(url).toContain('limit=5');
	});
});

describe('parseNominatimResults', () => {
	it('extracts display_name, lat, lon from Nominatim response', () => {
		const raw = [
			{ display_name: 'Eustis, Frontier County, NE', lat: '40.67', lon: '-100.03', otherField: 'x' }
		];
		const results = parseNominatimResults(raw);
		expect(results).toEqual([
			{ display_name: 'Eustis, Frontier County, NE', lat: 40.67, lon: -100.03 }
		]);
	});

	it('returns empty array for empty response', () => {
		expect(parseNominatimResults([])).toEqual([]);
	});
});

describe('geocode', () => {
	it('fetches and parses Nominatim results', async () => {
		const mockFetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: async () => [
				{ display_name: 'Eustis, NE', lat: '40.67', lon: '-100.03' }
			]
		});

		const results = await geocode('Eustis, NE', mockFetch as unknown as typeof fetch);
		expect(results).toHaveLength(1);
		expect(results[0].lat).toBe(40.67);
		expect(mockFetch).toHaveBeenCalledOnce();

		// Verify User-Agent header is sent
		const callArgs = mockFetch.mock.calls[0];
		expect(callArgs[1]?.headers?.['User-Agent']).toContain('FieldFinder');
	});

	it('returns empty array on fetch failure', async () => {
		const mockFetch = vi.fn().mockResolvedValueOnce({
			ok: false,
			status: 500
		});

		const results = await geocode('nowhere', mockFetch as unknown as typeof fetch);
		expect(results).toEqual([]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/server/geocode.spec.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/server/geocode.ts

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'FieldFinder/1.0';

export interface GeocodingResult {
	display_name: string;
	lat: number;
	lon: number;
}

export function buildNominatimUrl(query: string): string {
	const params = new URLSearchParams({
		q: query,
		format: 'json',
		limit: '5'
	});
	return `${NOMINATIM_BASE}?${params.toString()}`;
}

export function parseNominatimResults(
	raw: Array<{ display_name: string; lat: string; lon: string }>
): GeocodingResult[] {
	return raw.map((r) => ({
		display_name: r.display_name,
		lat: parseFloat(r.lat),
		lon: parseFloat(r.lon)
	}));
}

// Simple rate limiter: track last request time
let lastRequestTime = 0;

async function enforceRateLimit(): Promise<void> {
	const now = Date.now();
	const elapsed = now - lastRequestTime;
	if (elapsed < 1000) {
		await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
	}
	lastRequestTime = Date.now();
}

/**
 * Geocode a search query via Nominatim.
 * Enforces 1 req/sec rate limit and sends proper User-Agent.
 */
export async function geocode(
	query: string,
	fetchFn: typeof fetch = fetch
): Promise<GeocodingResult[]> {
	await enforceRateLimit();

	const url = buildNominatimUrl(query);

	try {
		const resp = await fetchFn(url, {
			headers: { 'User-Agent': USER_AGENT }
		});

		if (!resp.ok) {
			return [];
		}

		const raw = await resp.json();
		return parseNominatimResults(raw);
	} catch {
		return [];
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/server/geocode.spec.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/geocode.ts src/lib/server/geocode.spec.ts
git commit -m "feat: add Nominatim geocoding proxy with rate limiting"
```

---

## Task 7: API Route — POST /api/search

**Files:**
- Create: `src/routes/api/search/+server.ts`

This endpoint receives search parameters from the frontend, calls the coordinate and CDL modules, and returns the PNG URL + lat/lon bounds.

- [ ] **Step 1: Write the endpoint**

```ts
// src/routes/api/search/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { computeSearchBbox } from '$lib/server/coordinates';
import { fetchCdlData } from '$lib/server/cdl';

export const POST: RequestHandler = async ({ request, fetch }) => {
	const body = await request.json();

	// Validate required fields
	const { lat, lon, radius, year, crops } = body;
	if (typeof lat !== 'number' || typeof lon !== 'number') {
		error(400, 'lat and lon are required numbers');
	}
	if (typeof radius !== 'number' || radius < 1 || radius > 50) {
		error(400, 'radius must be between 1 and 50');
	}
	if (typeof year !== 'number' || year < 1997 || year > 2024) {
		error(400, 'year must be between 1997 and 2024');
	}
	if (!Array.isArray(crops)) {
		error(400, 'crops must be an array of CDL value IDs');
	}

	// Compute bounding boxes
	const { albers, latLon } = computeSearchBbox(lat, lon, radius);

	try {
		// Fetch CDL data
		const pngUrl = await fetchCdlData(
			{ year, albers, crops },
			fetch
		);

		return json({
			pngUrl,
			bounds: [
				[latLon.south, latLon.west],
				[latLon.north, latLon.east]
			]
		});
	} catch (err) {
		console.error('CDL API error:', err);
		error(502, 'Failed to fetch crop data from CDL API');
	}
};
```

- [ ] **Step 2: Manually test with curl (dev server running)**

Start the dev server if not running: `npm run dev`

```bash
curl -X POST http://localhost:5173/api/search \
  -H "Content-Type: application/json" \
  -d '{"lat": 40.554, "lon": -100.076, "radius": 5, "year": 2024, "crops": []}'
```

Expected: JSON response with `pngUrl` and `bounds` (may take several seconds — CDL API is slow).

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/search/+server.ts
git commit -m "feat: add POST /api/search endpoint for CDL data"
```

---

## Task 8: API Route — GET /api/geocode

**Files:**
- Create: `src/routes/api/geocode/+server.ts`

Proxies geocoding requests to the server-side Nominatim module.

- [ ] **Step 1: Write the endpoint**

```ts
// src/routes/api/geocode/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { geocode } from '$lib/server/geocode';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	if (!query || query.trim().length === 0) {
		error(400, 'Query parameter "q" is required');
	}

	const results = await geocode(query.trim());
	return json(results);
};
```

- [ ] **Step 2: Manually test with curl (dev server running)**

```bash
curl "http://localhost:5173/api/geocode?q=Eustis%2C+NE"
```

Expected: JSON array with geocoding results including `display_name`, `lat`, `lon`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/geocode/+server.ts
git commit -m "feat: add GET /api/geocode endpoint for Nominatim proxy"
```

---

## Task 9: Page Layout — Sidebar + Map Split

**Files:**
- Modify: `src/routes/+page.svelte`
- Create: `src/lib/components/Sidebar.svelte`
- Create: `src/lib/components/MapView.svelte`

Replace the default SvelteKit page with the two-zone layout: collapsible sidebar on the left, Leaflet map filling the rest.

- [ ] **Step 1: Create the Sidebar component**

```svelte
<!-- src/lib/components/Sidebar.svelte -->
<script lang="ts">
	let { collapsed = $bindable(false), children } = $props();
</script>

{#if !collapsed}
	<aside class="flex h-full w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-gray-200 bg-gray-50 p-4">
		<div class="flex items-center justify-between">
			<h1 class="text-xl font-bold text-gray-800">Field Finder</h1>
			<button
				onclick={() => (collapsed = true)}
				class="text-sm text-gray-500 hover:text-gray-700"
				aria-label="Collapse sidebar"
			>
				◀ Hide
			</button>
		</div>
		{@render children()}
	</aside>
{:else}
	<button
		onclick={() => (collapsed = false)}
		class="flex h-full w-10 shrink-0 items-start justify-center border-r border-gray-200 bg-gray-50 pt-4 text-gray-500 hover:text-gray-700"
		aria-label="Expand sidebar"
	>
		▶
	</button>
{/if}
```

- [ ] **Step 2: Create the MapView component (basic Leaflet initialization)**

```svelte
<!-- src/lib/components/MapView.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';

	let {
		center = $bindable<[number, number]>([39.8, -98.5]),
		zoom = 5,
		onMapClick
	}: {
		center?: [number, number];
		zoom?: number;
		onMapClick?: (lat: number, lon: number) => void;
	} = $props();

	let mapContainer: HTMLDivElement;
	let map: L.Map | undefined;

	onMount(async () => {
		const L = await import('leaflet');

		map = L.map(mapContainer).setView(center, zoom);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
		}).addTo(map);

		map.on('click', (e: L.LeafletMouseEvent) => {
			onMapClick?.(e.latlng.lat, e.latlng.lng);
		});

		return () => {
			map?.remove();
		};
	});
</script>

<div bind:this={mapContainer} class="h-full w-full"></div>
```

- [ ] **Step 3: Update the page layout**

Replace the contents of `src/routes/+page.svelte`:

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import { getSidebarCollapsed, saveSidebarCollapsed } from '$lib/localStorage';
	import { onMount } from 'svelte';

	let sidebarCollapsed = $state(false);
	let mapCenter = $state<[number, number]>([39.8, -98.5]);
	let mapZoom = $state(5);

	onMount(() => {
		const saved = getSidebarCollapsed(localStorage);
		if (saved !== null) sidebarCollapsed = saved;
	});

	$effect(() => {
		if (typeof window !== 'undefined') {
			saveSidebarCollapsed(sidebarCollapsed, localStorage);
		}
	});

	function handleMapClick(lat: number, lon: number) {
		// Will be wired up to set location marker in later tasks
		console.log('Map clicked:', lat, lon);
	}
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar bind:collapsed={sidebarCollapsed}>
		<p class="text-sm text-gray-500">Controls will go here.</p>
	</Sidebar>

	<main class="relative flex-1">
		<MapView bind:center={mapCenter} zoom={mapZoom} onMapClick={handleMapClick} />
	</main>
</div>
```

- [ ] **Step 4: Verify in browser**

```bash
npm run dev
```

Open the browser. Expected:
- Left sidebar with "Field Finder" title and "◀ Hide" button
- Map fills remaining space with OpenStreetMap tiles
- Sidebar collapse/expand works
- Clicking the map logs coordinates to the console

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte src/lib/components/Sidebar.svelte src/lib/components/MapView.svelte
git commit -m "feat: add page layout with collapsible sidebar and Leaflet map"
```

---

## Task 10: SearchBar Component

**Files:**
- Create: `src/lib/components/SearchBar.svelte`
- Modify: `src/routes/+page.svelte`

Text input that accepts addresses (geocoded via `/api/geocode`) or raw lat/lon coordinates. Debounced autocomplete dropdown.

- [ ] **Step 1: Create the SearchBar component**

```svelte
<!-- src/lib/components/SearchBar.svelte -->
<script lang="ts">
	let {
		onLocationSelect
	}: {
		onLocationSelect: (lat: number, lon: number, name?: string) => void;
	} = $props();

	let query = $state('');
	let results = $state<Array<{ display_name: string; lat: number; lon: number }>>([]);
	let showDropdown = $state(false);
	let error = $state('');
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	// Regex to detect lat/lon input: "40.554, -100.076" or "40.554 -100.076"
	const LATLON_REGEX = /^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/;

	function parseLatLon(input: string): { lat: number; lon: number } | null {
		const match = input.trim().match(LATLON_REGEX);
		if (!match) return null;
		const lat = parseFloat(match[1]);
		const lon = parseFloat(match[2]);
		if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
		return { lat, lon };
	}

	function handleInput() {
		error = '';
		const parsed = parseLatLon(query);
		if (parsed) {
			// Direct lat/lon — no need to geocode
			results = [];
			showDropdown = false;
			return;
		}

		// Debounce geocoding requests
		clearTimeout(debounceTimer);
		if (query.trim().length < 3) {
			results = [];
			showDropdown = false;
			return;
		}

		debounceTimer = setTimeout(async () => {
			try {
				const resp = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
				if (resp.ok) {
					results = await resp.json();
					showDropdown = results.length > 0;
					if (results.length === 0) {
						error = 'No results found';
					}
				}
			} catch {
				error = 'Geocoding failed';
			}
		}, 400);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			const parsed = parseLatLon(query);
			if (parsed) {
				onLocationSelect(parsed.lat, parsed.lon);
				showDropdown = false;
			} else if (results.length > 0) {
				selectResult(results[0]);
			}
		} else if (e.key === 'Escape') {
			showDropdown = false;
		}
	}

	function selectResult(result: { display_name: string; lat: number; lon: number }) {
		query = result.display_name;
		showDropdown = false;
		onLocationSelect(result.lat, result.lon, result.display_name);
	}
</script>

<div class="relative">
	<label for="search-input" class="mb-1 block text-sm font-semibold text-gray-700">Location</label>
	<input
		id="search-input"
		type="text"
		bind:value={query}
		oninput={handleInput}
		onkeydown={handleKeydown}
		onfocusout={() => setTimeout(() => (showDropdown = false), 200)}
		placeholder="Search address or lat, lon..."
		class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
	/>
	{#if error}
		<p class="mt-1 text-xs text-red-500">{error}</p>
	{/if}
	{#if showDropdown}
		<ul class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
			{#each results as result}
				<li>
					<button
						type="button"
						class="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
						onmousedown={() => selectResult(result)}
					>
						{result.display_name}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
```

- [ ] **Step 2: Wire SearchBar into the page**

Update `src/routes/+page.svelte` — add the SearchBar import and replace the placeholder text inside the Sidebar `children` block:

Add import:
```ts
import SearchBar from '$lib/components/SearchBar.svelte';
```

Replace `<p class="text-sm text-gray-500">Controls will go here.</p>` with:
```svelte
<SearchBar onLocationSelect={handleLocationSelect} />
```

Add the handler function:
```ts
function handleLocationSelect(lat: number, lon: number, name?: string) {
	mapCenter = [lat, lon];
	mapZoom = 12;
	// Will set location marker in MapView task
}
```

- [ ] **Step 3: Verify in browser**

Test:
1. Type "Eustis, NE" → autocomplete dropdown appears → select a result → map pans
2. Type "40.554, -100.076" → press Enter → map pans to those coordinates
3. Type "asdfghjkl" → "No results found" error appears

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/SearchBar.svelte src/routes/+page.svelte
git commit -m "feat: add SearchBar with geocoding autocomplete and lat/lon parsing"
```

---

## Task 11: RadiusSlider, YearSelector, CropFilter, SearchButton Components

**Files:**
- Create: `src/lib/components/RadiusSlider.svelte`
- Create: `src/lib/components/YearSelector.svelte`
- Create: `src/lib/components/CropFilter.svelte`
- Create: `src/lib/components/SearchButton.svelte`
- Modify: `src/routes/+page.svelte`

These four small components live in the sidebar below the SearchBar.

- [ ] **Step 1: Create RadiusSlider**

```svelte
<!-- src/lib/components/RadiusSlider.svelte -->
<script lang="ts">
	let { radius = $bindable(10) }: { radius?: number } = $props();
</script>

<div>
	<label for="radius-slider" class="mb-1 block text-sm font-semibold text-gray-700">
		Radius: {radius} {radius === 1 ? 'mile' : 'miles'}
	</label>
	<input
		id="radius-slider"
		type="range"
		min="1"
		max="50"
		bind:value={radius}
		class="w-full"
	/>
	{#if radius > 15}
		<p class="mt-1 text-xs text-amber-600">Larger areas may take longer to load</p>
	{/if}
</div>
```

- [ ] **Step 2: Create YearSelector**

```svelte
<!-- src/lib/components/YearSelector.svelte -->
<script lang="ts">
	let { year = $bindable(2024) }: { year?: number } = $props();

	// CDL data available from 1997-2024
	const years = Array.from({ length: 2024 - 1997 + 1 }, (_, i) => 2024 - i);
</script>

<div>
	<label for="year-select" class="mb-1 block text-sm font-semibold text-gray-700">Year</label>
	<select
		id="year-select"
		bind:value={year}
		class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
	>
		{#each years as y}
			<option value={y}>{y}</option>
		{/each}
	</select>
</div>
```

- [ ] **Step 3: Create CropFilter**

```svelte
<!-- src/lib/components/CropFilter.svelte -->
<script lang="ts">
	import { getAllCrops, type CropKey } from '$lib/crops';

	let {
		selected = $bindable<Record<CropKey, boolean>>({} as Record<CropKey, boolean>)
	}: {
		selected?: Record<CropKey, boolean>;
	} = $props();

	const crops = getAllCrops();

	// Initialize all to true if not already set
	$effect(() => {
		for (const crop of crops) {
			if (selected[crop.key] === undefined) {
				selected[crop.key] = true;
			}
		}
	});
</script>

<fieldset>
	<legend class="mb-1 text-sm font-semibold text-gray-700">Crop Types</legend>
	<div class="flex flex-col gap-1">
		{#each crops as crop}
			<label class="flex items-center gap-2 text-sm text-gray-700">
				<input type="checkbox" bind:checked={selected[crop.key]} class="rounded" />
				<span
					class="inline-block h-3 w-3 rounded-sm"
					style="background-color: {crop.color}"
				></span>
				{crop.name}
			</label>
		{/each}
	</div>
</fieldset>
```

- [ ] **Step 4: Create SearchButton**

```svelte
<!-- src/lib/components/SearchButton.svelte -->
<script lang="ts">
	let {
		loading = false,
		disabled = false,
		onclick
	}: {
		loading?: boolean;
		disabled?: boolean;
		onclick: () => void;
	} = $props();
</script>

<button
	type="button"
	{onclick}
	disabled={disabled || loading}
	class="w-full rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
>
	{#if loading}
		Searching...
	{:else}
		Search
	{/if}
</button>
```

- [ ] **Step 5: Wire all components into the page**

Replace `src/routes/+page.svelte` with the full wiring:

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import RadiusSlider from '$lib/components/RadiusSlider.svelte';
	import YearSelector from '$lib/components/YearSelector.svelte';
	import CropFilter from '$lib/components/CropFilter.svelte';
	import SearchButton from '$lib/components/SearchButton.svelte';
	import { CROPS, type CropKey } from '$lib/crops';
	import {
		getSidebarCollapsed, saveSidebarCollapsed,
		getLastLocation, saveLastLocation,
		getLastRadius, saveLastRadius,
		getCropFilters, saveCropFilters
	} from '$lib/localStorage';

	let sidebarCollapsed = $state(false);
	let mapCenter = $state<[number, number]>([39.8, -98.5]);
	let mapZoom = $state(5);
	let radius = $state(10);
	let year = $state(2024);
	let cropFilters = $state<Record<CropKey, boolean>>({} as Record<CropKey, boolean>);
	let loading = $state(false);
	let overlayUrl = $state('');
	let overlayBounds = $state<[[number, number], [number, number]] | undefined>(undefined);
	let errorMessage = $state('');
	let hasLocation = $state(false);

	onMount(() => {
		const savedCollapsed = getSidebarCollapsed(localStorage);
		if (savedCollapsed !== null) sidebarCollapsed = savedCollapsed;

		const savedLocation = getLastLocation(localStorage);
		if (savedLocation) {
			mapCenter = [savedLocation.lat, savedLocation.lon];
			mapZoom = 12;
			hasLocation = true;
		}

		const savedRadius = getLastRadius(localStorage);
		if (savedRadius !== null) radius = savedRadius;

		const savedFilters = getCropFilters(localStorage);
		if (savedFilters) cropFilters = savedFilters as Record<CropKey, boolean>;
	});

	// Persist state changes to localStorage
	$effect(() => { saveSidebarCollapsed(sidebarCollapsed, localStorage); });
	$effect(() => { saveLastRadius(radius, localStorage); });
	$effect(() => { saveCropFilters(cropFilters, localStorage); });

	function handleLocationSelect(lat: number, lon: number, _name?: string) {
		mapCenter = [lat, lon];
		mapZoom = 12;
		hasLocation = true;
		saveLastLocation({ lat, lon }, localStorage);
	}

	function handleMapClick(lat: number, lon: number) {
		mapCenter = [lat, lon];
		hasLocation = true;
		saveLastLocation({ lat, lon }, localStorage);
	}

	async function handleSearch() {
		if (!hasLocation) return;

		loading = true;
		errorMessage = '';

		// Collect selected crop IDs
		const selectedCropIds = Object.entries(cropFilters)
			.filter(([, checked]) => checked)
			.map(([key]) => CROPS[key as CropKey].id);

		try {
			const resp = await fetch('/api/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					lat: mapCenter[0],
					lon: mapCenter[1],
					radius,
					year,
					crops: selectedCropIds
				})
			});

			if (!resp.ok) {
				const err = await resp.json().catch(() => ({ message: 'Unknown error' }));
				errorMessage = err.message || "Couldn't fetch crop data — try again";
				return;
			}

			const data = await resp.json();
			overlayUrl = data.pngUrl;
			overlayBounds = data.bounds;
		} catch {
			errorMessage = "Couldn't fetch crop data — try again";
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar bind:collapsed={sidebarCollapsed}>
		<SearchBar onLocationSelect={handleLocationSelect} />
		<RadiusSlider bind:radius />
		<YearSelector bind:year />
		<CropFilter bind:selected={cropFilters} />
		<SearchButton onclick={handleSearch} {loading} disabled={!hasLocation} />
	</Sidebar>

	<main class="relative flex-1">
		<MapView
			bind:center={mapCenter}
			zoom={mapZoom}
			{radius}
			{overlayUrl}
			{overlayBounds}
			{loading}
			{errorMessage}
			onMapClick={handleMapClick}
		/>
	</main>
</div>
```

- [ ] **Step 6: Verify in browser**

Test:
1. All sidebar controls render and are interactive
2. Radius slider shows warning text above 15 miles
3. Year dropdown lists 1997-2024 with 2024 as default
4. Crop checkboxes show color swatches and are all checked by default
5. Search button shows "Searching..." while loading, disabled state works
6. Collapsing sidebar hides all controls, expanding restores them

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/RadiusSlider.svelte src/lib/components/YearSelector.svelte \
  src/lib/components/CropFilter.svelte src/lib/components/SearchButton.svelte \
  src/routes/+page.svelte
git commit -m "feat: add radius slider, year selector, crop filter, and search button"
```

---

## Task 12: Map Features — Location Marker, Bounding Box, Crop Overlay

**Files:**
- Modify: `src/lib/components/MapView.svelte`
- Modify: `src/routes/+page.svelte`

Enhance the map with:
- Location marker that moves when user clicks map or searches
- Real-time bounding box rectangle that updates with radius/location changes
- CDL crop PNG overlay that renders after search

- [ ] **Step 1: Add location marker and bounding box to MapView**

Update `MapView.svelte` to accept new props and manage Leaflet layers:

```ts
let {
	center = $bindable<[number, number]>([39.8, -98.5]),
	zoom = 5,
	radius = 10,
	overlayUrl = '',
	overlayBounds = undefined as [[number, number], [number, number]] | undefined,
	loading = false,
	errorMessage = '',
	onMapClick
}: {
	center?: [number, number];
	zoom?: number;
	radius?: number;
	overlayUrl?: string;
	overlayBounds?: [[number, number], [number, number]];
	loading?: boolean;
	errorMessage?: string;
	onMapClick?: (lat: number, lon: number) => void;
} = $props();
```

Add Leaflet layer management:
- **Location marker**: `L.marker(center)` — update position when `center` changes via `$effect`
- **Bounding box rectangle**: `L.rectangle(bounds, { color: '#3388ff', weight: 2, fill: false })` — recalculate bounds from `center` + `radius` via `$effect`, importing `computeBboxLatLon` from `$lib/geo` (this is the shared client-safe module, not the server-only `coordinates.ts`)
- **Crop overlay**: `L.imageOverlay(overlayUrl, overlayBounds, { crossOrigin: 'anonymous' })` — add/replace when `overlayUrl` changes via `$effect`
- **Loading indicator**: a simple `<div>` overlay positioned absolutely on top of the map when `loading` is true
- **Error message**: similar overlay for error state

- [ ] **Step 2: Wire map props from page state**

Update `src/routes/+page.svelte`:
- Pass `radius`, `overlayUrl`, `overlayBounds`, `loading`, `errorMessage` to `MapView`
- Implement `handleSearch()` function that:
  1. Sets `loading = true`
  2. Calls `POST /api/search` with current state
  3. On success: sets `overlayUrl` and `overlayBounds`
  4. On failure: sets `errorMessage`
  5. Sets `loading = false`
- Connect `handleSearch` to the SearchButton's `onclick`
- Update `handleMapClick` to set `mapCenter` (which moves marker + bbox)
- Update `handleLocationSelect` from SearchBar to set `mapCenter` and `mapZoom`

- [ ] **Step 3: Add localStorage persistence for location and radius**

In `onMount`, load saved location, radius, and crop filters from localStorage. In `$effect` blocks, persist them when they change.

- [ ] **Step 4: Verify in browser — full search flow**

Test the complete flow:
1. Type "Eustis, NE" in search bar → select result → marker appears, map pans, bbox rectangle visible
2. Adjust radius slider → bbox rectangle updates in real time
3. Click Search → loading indicator shows → crop overlay appears on map
4. Click a different spot on the map → marker and bbox move, overlay remains from previous search
5. Click Search again → new overlay replaces old one
6. Refresh page → last location and radius are restored

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/MapView.svelte src/routes/+page.svelte
git commit -m "feat: add location marker, bounding box preview, and crop overlay to map"
```

---

## Task 13: Legend Component

**Files:**
- Create: `src/lib/components/Legend.svelte`
- Modify: `src/lib/components/MapView.svelte`

Floating color legend on the map (bottom-left corner). Reads from the shared `CROPS` config. Implemented as an absolutely positioned div over the map (not a Leaflet control, to keep it simple and styled with Tailwind).

- [ ] **Step 1: Create the Legend component**

```svelte
<!-- src/lib/components/Legend.svelte -->
<script lang="ts">
	import { getAllCrops } from '$lib/crops';

	const crops = getAllCrops();
</script>

<div class="absolute bottom-4 left-4 z-1000 rounded-lg bg-white/95 px-3 py-2 shadow-md">
	<h3 class="mb-1 text-xs font-semibold text-gray-700">Legend</h3>
	<div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
		{#each crops as crop}
			<div class="flex items-center gap-1.5 text-xs text-gray-600">
				<span class="inline-block h-2.5 w-2.5 rounded-sm" style="background-color: {crop.color}"></span>
				{crop.name}
			</div>
		{/each}
	</div>
</div>
```

- [ ] **Step 2: Add Legend to MapView**

Import and render `Legend` inside the MapView's container div, positioned absolutely so it floats over the map.

- [ ] **Step 3: Verify in browser**

Confirm the legend appears in the bottom-left corner of the map with correct crop names and color swatches matching the CropFilter checkboxes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/Legend.svelte src/lib/components/MapView.svelte
git commit -m "feat: add color legend overlay on map"
```

---

## Task 14: Waypoints — Drop, Name, Delete, Persist

**Files:**
- Create: `src/lib/components/WaypointPopup.svelte`
- Modify: `src/lib/components/MapView.svelte`
- Modify: `src/routes/+page.svelte`

Users right-click (desktop) or long-press (mobile) to drop a waypoint. Click a waypoint to see a popup where they can name or delete it. Waypoints persist in localStorage.

- [ ] **Step 1: Create WaypointPopup component**

This will be rendered as Leaflet popup content. Since Leaflet popups use raw HTML strings, we'll build the popup HTML in MapView and handle events there rather than using a Svelte component. Rename this to a utility approach within MapView.

Instead, add waypoint logic directly in `MapView.svelte`:

- Listen for `contextmenu` event on the map (right-click) → add a waypoint marker at that location
- Each waypoint marker gets a popup with:
  - A text input for the name (pre-filled if named)
  - A "Save" button
  - A "Delete" button
- On save: update the waypoint's name in the array, persist to localStorage
- On delete: remove the marker and waypoint from the array, persist to localStorage
- Waypoints use a different icon color than the location marker (e.g., blue vs red)

- [ ] **Step 2: Wire waypoint state from page**

Pass `waypoints` array as a bindable prop to MapView. Load from localStorage on mount, persist on changes via `$effect`.

- [ ] **Step 3: Verify in browser**

Test:
1. Right-click map → waypoint marker appears (different color from location marker)
2. Click waypoint → popup with name input and Save/Delete buttons
3. Type a name, click Save → popup closes, name persists
4. Click waypoint again → shows saved name
5. Click Delete → waypoint removed
6. Add multiple waypoints → run a search → waypoints remain after overlay loads
7. Refresh page → waypoints are restored from localStorage

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/MapView.svelte src/routes/+page.svelte
git commit -m "feat: add persistent waypoints with right-click drop, naming, and deletion"
```

---

## Task 15: Error Handling & Polish

**Files:**
- Modify: `src/lib/components/MapView.svelte`
- Modify: `src/routes/+page.svelte`

Add error handling for all failure modes listed in the spec, and polish the loading states.

- [ ] **Step 1: Handle CDL API errors in search flow**

In `+page.svelte`'s `handleSearch()`:
- Catch fetch failures and CDL API errors (502 from our endpoint)
- Set `errorMessage` state that MapView displays as an overlay on the map
- Clear error when a new search starts

- [ ] **Step 2: Handle PNG load failures in MapView**

When creating the `L.imageOverlay`, listen for the `error` event:
```ts
overlay.on('error', () => {
	errorMessage = 'Failed to load crop data image';
});
```

- [ ] **Step 3: Handle "no data" response**

If the CDL API returns successfully but the PNG URL is empty or invalid, show: "No crop data available for this area in [year]"

- [ ] **Step 4: Verify all error scenarios**

Test:
1. Search with a valid location → success (baseline)
2. Disconnect network → Search → error message on map
3. Search in the ocean (no crop data) → appropriate message
4. Verify error clears when starting a new search

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/MapView.svelte src/routes/+page.svelte
git commit -m "feat: add error handling for CDL API failures and PNG load errors"
```

---

## Task 16: Clean Up & Final Verification

**Files:**
- Delete: `src/lib/vitest-examples/` (scaffold examples no longer needed)
- Modify: `src/lib/index.ts` (remove example export if present)

- [ ] **Step 1: Remove scaffold example files**

```bash
rm -rf src/lib/vitest-examples
```

Update `src/lib/index.ts` to remove any example exports (or leave it empty if nothing else is exported yet).

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: All tests pass (crops, localStorage, coordinates, CDL, geocode).

- [ ] **Step 3: Run linting and type checking**

```bash
npm run lint
npm run check
```

Fix any issues.

- [ ] **Step 4: Run the full app and test end-to-end**

```bash
npm run dev
```

Walk through the full user flow:
1. App loads, map centered on continental US
2. Search for "Eustis, NE" → map pans, marker appears, bbox rectangle shows
3. Adjust radius to 10 miles → bbox updates in real time
4. Select year 2024, check desired crops
5. Click Search → loading indicator → crop overlay renders on map
6. Legend visible in bottom-left with correct colors
7. Right-click to drop waypoints → name one, leave another unnamed
8. Click a different spot → marker moves, bbox moves, overlay stays
9. Search again → new overlay replaces old, waypoints remain
10. Collapse sidebar → map takes full width
11. Refresh page → last location, radius, crop filters, waypoints all restored

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove scaffold examples and verify full app"
```
