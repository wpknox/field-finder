# GeoTIFF Overlay, Opacity Control & Placement Accuracy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pixelating PNG image overlay with a zoom-independent GeoTIFF renderer, add an opacity slider for inspecting alignment, compute and display crop percentage breakdowns (area summary), and verify placement accuracy.

**Architecture:** The server already calls `GetCDLFile` and (optionally) `ExtractCDLByValues`, which return GeoTIFF raster URLs. Today we additionally call `GetCDLImage` to get a PNG, then base64-encode and send it via SSE. The change: skip `GetCDLImage`, download the `.tif` binary instead, base64-encode it, and send it in the SSE done event. The client decodes the base64 to an `ArrayBuffer`, parses it with `georaster`, and renders it with `georaster-layer-for-leaflet` (a Leaflet `GridLayer` that re-renders tiles per zoom level). The GeoTIFF embeds its own projection (EPSG:5070 Albers) and color table, so georaster-layer-for-leaflet handles reprojection and coloring automatically via `proj4`.

**Tech Stack:** georaster, georaster-layer-for-leaflet, proj4 (already installed), Leaflet GridLayer, Svelte 5 `$state`/`$effect`/`untrack`

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `src/lib/types/georaster.d.ts` | TypeScript declarations for `georaster` |
| `src/lib/types/georaster-layer-for-leaflet.d.ts` | TypeScript declarations for `georaster-layer-for-leaflet` |
| `src/lib/components/OpacitySlider.svelte` | Overlay opacity slider (0%–100%) |
| `src/lib/cropStats.ts` | Compute crop percentage breakdown from georaster pixel values |
| `src/lib/cropStats.spec.ts` | Tests for cropStats |
| `src/lib/components/AreaSummary.svelte` | Sidebar panel showing crop name, color swatch, and % |
| `src/lib/projections.ts` | Shared EPSG projection string constants (imported by both server and client) |

### Modified Files

| File | What Changes |
|------|-------------|
| `src/lib/server/coordinates.ts` | Import `EPSG_5070` from `$lib/projections` instead of defining it inline |
| `src/lib/server/cdl.ts` | Remove `GetCDLImage` step from `fetchCdlData`; remove `buildImageUrl`; update `CdlProgressStep` type |
| `src/lib/server/cdl.spec.ts` | Update tests: fewer API calls, raster URL return instead of PNG URL |
| `src/routes/api/search/+server.ts` | Fetch `.tif` binary (not PNG), base64-encode, send as `tifBase64` in SSE done event |
| `src/lib/components/MapView.svelte` | Replace `L.imageOverlay` with `GeoRasterLayer`; add `$state` overlay + opacity `$effect`; `loadingMessage` becomes `$bindable` |
| `src/routes/+page.svelte` | Replace `overlayUrl`/`overlayBounds` state with `tifBase64`; add `overlayOpacity` state; bind `loadingMessage` to MapView |
| `src/lib/localStorage.ts` | Add `saveOverlayOpacity` / `getOverlayOpacity` |
| `src/lib/localStorage.spec.ts` | Test opacity persistence |
| `package.json` | Add `georaster`, `georaster-layer-for-leaflet` |

### Removed Code

- `buildImageUrl()` in `cdl.ts` — no longer calling `GetCDLImage`
- `overlayUrl` and `overlayBounds` props/state — replaced by `tifBase64`
- `'preparing'` step from `CdlProgressStep` — that step no longer exists

---

## Task 1: Extract Shared Projection Constants, Install Dependencies, and Type Declarations

**Files:**
- Create: `src/lib/projections.ts`
- Modify: `src/lib/server/coordinates.ts`
- Modify: `package.json`
- Create: `src/lib/types/georaster.d.ts`
- Create: `src/lib/types/georaster-layer-for-leaflet.d.ts`

- [ ] **Step 1: Extract EPSG_5070 to a shared module**

Create `src/lib/projections.ts`:

```typescript
/** Albers Equal Area Conic for CONUS (used by USDA CDL API). */
export const EPSG_5070 =
	'+proj=aea +lat_0=23 +lon_0=-96 +lat_1=29.5 +lat_2=45.5 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs';
```

Update `src/lib/server/coordinates.ts` — replace the inline constant with an import:

```typescript
import { EPSG_5070 } from '$lib/projections';
// DELETE the old local constant:
// const EPSG_5070 = '+proj=aea ...';
```

Then update the `proj4.defs` call in MapView (Task 5) to also import from `$lib/projections` instead of hardcoding the string.

Run `npm run check` to confirm no type errors.

- [ ] **Step 2: Install georaster and georaster-layer-for-leaflet**

```bash
npm install georaster georaster-layer-for-leaflet
```

- [ ] **Step 3: Create georaster type declarations**

Create `src/lib/types/georaster.d.ts`:

```typescript
declare module 'georaster' {
	export interface GeoRaster {
		height: number;
		width: number;
		numberOfRasters: number;
		projection: number | string;
		xmin: number;
		ymin: number;
		xmax: number;
		ymax: number;
		pixelHeight: number;
		pixelWidth: number;
		values: number[][][];
		noDataValue: number | null;
	}

	export default function parseGeoraster(input: ArrayBuffer): Promise<GeoRaster>;
}
```

- [ ] **Step 4: Create georaster-layer-for-leaflet type declarations**

Create `src/lib/types/georaster-layer-for-leaflet.d.ts`:

```typescript
declare module 'georaster-layer-for-leaflet' {
	import type { GridLayerOptions, GridLayer, Map } from 'leaflet';
	import type { GeoRaster } from 'georaster';

	interface GeoRasterLayerOptions extends GridLayerOptions {
		georaster: GeoRaster;
		opacity?: number;
		resolution?: number;
		debugLevel?: number;
		proj4?: unknown;
		pixelValuesToColorFn?: (values: number[]) => string | null;
	}

	export default class GeoRasterLayer extends GridLayer {
		constructor(options: GeoRasterLayerOptions);
		addTo(map: Map): this;
	}
}
```

- [ ] **Step 5: Verify the build still compiles**

```bash
npm run check
```

Expected: No new type errors. If Vite has trouble resolving the new packages, add them to `optimizeDeps.include` in `vite.config.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/projections.ts src/lib/server/coordinates.ts package.json package-lock.json src/lib/types/
git commit -m "chore: extract EPSG_5070 to shared module; add georaster and georaster-layer-for-leaflet with type declarations"
```

---

## Task 2: Simplify fetchCdlData — Return Raster URL (TDD)

**Files:**
- Modify: `src/lib/server/cdl.spec.ts`
- Modify: `src/lib/server/cdl.ts`

The CDL pipeline today: `GetCDLFile` -> `ExtractCDLByValues` -> `GetCDLImage` -> PNG URL.
New pipeline: `GetCDLFile` -> `ExtractCDLByValues` -> raster URL. Skip `GetCDLImage` entirely because the client will render the GeoTIFF directly.

- [ ] **Step 1: Write the failing tests**

Replace the `fetchCdlData` describe block and the `buildImageUrl` test in `src/lib/server/cdl.spec.ts`:

Remove this test entirely:
```typescript
it('buildImageUrl constructs correct URL', () => { ... });
```

Replace the existing `fetchCdlData` tests with:

```typescript
describe('fetchCdlData', () => {
	it('calls GetCDLFile and ExtractCDLByValues, returns filtered raster URL', async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				text: async () =>
					`<r><returnURL>https://nassgeodata.gmu.edu/raster.tif</returnURL></r>`
			})
			.mockResolvedValueOnce({
				ok: true,
				text: async () =>
					`<r><returnURL>https://nassgeodata.gmu.edu/filtered.tif</returnURL></r>`
			});

		const result = await fetchCdlData(
			{
				year: 2024,
				albers: { xMin: -300000, yMin: 1800000, xMax: -280000, yMax: 1820000 },
				crops: [4, 24]
			},
			mockFetch as unknown as typeof fetch
		);

		expect(result).toBe('https://nassgeodata.gmu.edu/filtered.tif');
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('returns raster URL directly when no crops filter', async () => {
		const mockFetch = vi.fn().mockResolvedValueOnce({
			ok: true,
			text: async () =>
				`<r><returnURL>https://nassgeodata.gmu.edu/raster.tif</returnURL></r>`
		});

		const result = await fetchCdlData(
			{
				year: 2024,
				albers: { xMin: -300000, yMin: 1800000, xMax: -280000, yMax: 1820000 },
				crops: []
			},
			mockFetch as unknown as typeof fetch
		);

		expect(result).toBe('https://nassgeodata.gmu.edu/raster.tif');
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('invokes onProgress for each step', async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				text: async () =>
					`<r><returnURL>https://nassgeodata.gmu.edu/raster.tif</returnURL></r>`
			})
			.mockResolvedValueOnce({
				ok: true,
				text: async () =>
					`<r><returnURL>https://nassgeodata.gmu.edu/filtered.tif</returnURL></r>`
			});

		const steps: string[] = [];
		await fetchCdlData(
			{
				year: 2024,
				albers: { xMin: -300000, yMin: 1800000, xMax: -280000, yMax: 1820000 },
				crops: [4, 24]
			},
			mockFetch as unknown as typeof fetch,
			(step) => steps.push(step)
		);

		expect(steps).toEqual(['fetching', 'extracting']);
	});
});
```

Also remove the `buildImageUrl` import from the top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: `fetchCdlData` tests FAIL (still returns PNG URL, calls 3 times instead of 2).

- [ ] **Step 3: Implement the changes in cdl.ts**

In `src/lib/server/cdl.ts`:

1. Remove `buildImageUrl`:
```typescript
// DELETE lines 14-16
export function buildImageUrl(rasterUrl: string): string {
	return `${CDL_BASE}/GetCDLImage?files=${encodeURIComponent(rasterUrl)}&format=png`;
}
```

2. Update `CdlProgressStep` — remove `'preparing'`:
```typescript
export type CdlProgressStep = 'fetching' | 'extracting';
```

3. Remove step 3 from `fetchCdlData` — delete the `GetCDLImage` call and return `rasterUrl` directly:

Replace lines 72-81:
```typescript
	// Step 3: Get PNG image
	onProgress?.('preparing');
	const imageUrl = buildImageUrl(rasterUrl);
	const imageResp = await fetchFn(imageUrl);
	if (!imageResp.ok) {
		throw new Error(`CDL GetCDLImage failed: ${imageResp.status}`);
	}
	return parseReturnUrl(await imageResp.text());
```

With:
```typescript
	return rasterUrl;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests PASS. The `buildImageUrl` test is gone, `fetchCdlData` tests match the new 2-step / 1-step flow.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/cdl.ts src/lib/server/cdl.spec.ts
git commit -m "refactor: simplify fetchCdlData to return raster URL, skip GetCDLImage step"
```

---

## Task 3: Update /api/search to Send GeoTIFF Binary

**Files:**
- Modify: `src/routes/api/search/+server.ts`

The search endpoint currently fetches a PNG and sends it as base64. Now it fetches the `.tif` raster (the URL returned by `fetchCdlData`) and sends that as base64 instead.

- [ ] **Step 1: Update PROGRESS_MESSAGES and SSE done event**

In `src/routes/api/search/+server.ts`:

1. Remove `'preparing'` from `PROGRESS_MESSAGES` (line 9):

```typescript
const PROGRESS_MESSAGES: Record<CdlProgressStep, string> = {
	fetching: 'Fetching crop data...',
	extracting: 'Extracting crop information...'
};
```

2. Replace the SSE stream body (lines 52–80) with:

```typescript
				const rasterUrl = await fetchCdlData(
					{ year, albers, crops },
					fetch,
					(step) => send({ type: 'progress', message: PROGRESS_MESSAGES[step] })
				);

				if (typeof rasterUrl !== 'string' || rasterUrl.trim() === '') {
					send({ type: 'error', message: 'CDL API returned an invalid raster URL' });
					return;
				}

				send({ type: 'progress', message: 'Downloading crop data...' });
				const tifResp = await fetch(rasterUrl);
				if (!tifResp.ok) {
					send({
						type: 'error',
						message: 'Failed to download crop data from CDL server'
					});
					return;
				}

				const tifBuffer = await tifResp.arrayBuffer();
				const tifBase64 = Buffer.from(tifBuffer).toString('base64');

				send({ type: 'done', tifBase64 });
```

Key changes vs. the old code:
- Variable renamed from `pngUrl` to `rasterUrl`
- Progress message: "Downloading crop data..." instead of "Downloading image..."
- Done event: `{ type: 'done', tifBase64 }` instead of `{ type: 'done', pngUrl, bounds }`
- `bounds` removed from done event — GeoRasterLayer reads bounds from the GeoTIFF metadata

- [ ] **Step 2: Verify the build compiles**

```bash
npm run check
```

Expected: Compiles. The client won't work yet (it still expects `pngUrl`), but the server compiles independently.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/search/+server.ts
git commit -m "feat: send GeoTIFF binary via SSE instead of PNG"
```

---

## Task 4: Update +page.svelte Client Data Flow

**Files:**
- Modify: `src/routes/+page.svelte`

Replace `overlayUrl` / `overlayBounds` state with `tifBase64`. Handle loading state handoff to MapView.

- [ ] **Step 1: Replace state declarations**

In `src/routes/+page.svelte`, replace lines 34–35:

```typescript
	let overlayUrl = $state('');
	let overlayBounds = $state<[[number, number], [number, number]] | undefined>(undefined);
```

With:

```typescript
	let tifBase64 = $state('');
	let overlayOpacity = $state(0.7);
```

- [ ] **Step 2: Add opacity localStorage restore in onMount**

After the existing `savedWaypoints` block (around line 60), add:

```typescript
		const savedOpacity = getOverlayOpacity(localStorage);
		if (savedOpacity !== null) overlayOpacity = savedOpacity;
```

And add the import at the top (extend the existing import from `$lib/localStorage`):

```typescript
import {
	// ... existing imports ...
	getOverlayOpacity,
	saveOverlayOpacity
} from '$lib/localStorage';
```

- [ ] **Step 3: Add opacity persistence $effect**

After the existing `saveCropFilters` effect (around line 71), add:

```typescript
	$effect(() => {
		saveOverlayOpacity(overlayOpacity, localStorage);
	});
```

- [ ] **Step 4: Update handleSearch to read tifBase64 from SSE done event**

Replace the SSE handling in `handleSearch` (lines 92–148):

```typescript
	async function handleSearch() {
		if (!hasLocation) return;

		loadingMessage = 'Starting...';
		errorMessage = '';
		let handedOffToMap = false;

		try {
			const selectedCropIds = Object.entries(cropFilters)
				.filter(([, checked]) => checked)
				.map(([key]) => CROPS[key as CropKey].id);

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

			if (!resp.ok || !resp.body) {
				errorMessage = "Couldn't fetch crop data — try again";
				return;
			}

			const reader = resp.body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				for (const line of decoder.decode(value).split('\n')) {
					if (!line.startsWith('data: ')) continue;
					const event = JSON.parse(line.slice(6));

					if (event.type === 'progress') {
						loadingMessage = event.message;
					} else if (event.type === 'done') {
						tifBase64 = event.tifBase64;
						handedOffToMap = true;
					} else if (event.type === 'error') {
						errorMessage = event.message || "Couldn't fetch crop data — try again";
					}
				}
			}
		} catch {
			errorMessage = "Couldn't fetch crop data — try again";
		} finally {
			if (!handedOffToMap) {
				loadingMessage = '';
			}
			// If handedOffToMap is true, MapView manages loadingMessage
			// from here — it will clear it when GeoTIFF rendering finishes
		}
	}
```

Key change: `handedOffToMap` flag prevents clearing `loadingMessage` in `finally` when the done event was received. MapView takes over loading state during GeoTIFF rendering.

- [ ] **Step 5: Update MapView props in the template**

Replace the `<MapView>` block (lines 165–176):

```svelte
		<MapView
			bind:center={mapCenter}
			zoom={mapZoom}
			{radius}
			{tifBase64}
			{overlayOpacity}
			bind:loadingMessage
			{panVersion}
			bind:errorMessage
			bind:waypoints
			onMapClick={handleMapClick}
		/>
```

Changes:
- `{overlayUrl}` and `{overlayBounds}` removed
- `{tifBase64}` and `{overlayOpacity}` added
- `{loadingMessage}` changed to `bind:loadingMessage` (bidirectional — MapView can set it)

- [ ] **Step 6: Add OpacitySlider to the sidebar**

Add the import:
```typescript
import OpacitySlider from '$lib/components/OpacitySlider.svelte';
```

Add `<OpacitySlider>` in the sidebar, after `<CropFilter>` and before `<SearchButton>`:
```svelte
		<OpacitySlider bind:opacity={overlayOpacity} />
```

- [ ] **Step 7: Verify build compiles**

```bash
npm run check
```

Expected: May show errors for MapView props (not updated yet) and missing OpacitySlider (not created yet). That's fine — these are addressed in Tasks 5 and 6.

- [ ] **Step 8: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: update page state model for GeoTIFF overlay and opacity control"
```

---

## Task 5: Replace imageOverlay with GeoRasterLayer in MapView

**Files:**
- Modify: `src/lib/components/MapView.svelte`

This is the core change. Replace the Leaflet `imageOverlay` with `georaster` + `georaster-layer-for-leaflet`.

**Key design decisions:**
- `overlay` becomes `$state` so the opacity `$effect` can track it
- Main overlay `$effect` uses `untrack` to read `overlay` (for cleanup) without making it a dependency
- `overlayOpacity` is read via `untrack` in the main `$effect` for initial value; a separate `$effect` handles reactive opacity updates
- Base64 decode: `atob` + `Uint8Array` (standard approach)
- Dynamic imports: `georaster`, `georaster-layer-for-leaflet`, and `proj4` are imported inside the async callback (SSR safety + code splitting)
- Stale check: captures `tifBase64` at effect start, compares after async work

- [ ] **Step 1: Update the script tag imports**

At the top of `MapView.svelte`, add `untrack`:

```typescript
import { onMount, untrack } from 'svelte';
```

- [ ] **Step 2: Update props**

Replace the props block (lines 9–31) with:

```typescript
	let {
		center = $bindable<[number, number]>([39.8, -98.5]),
		zoom = 5,
		radius = 10,
		tifBase64 = '',
		overlayOpacity = 0.7,
		loadingMessage = $bindable(''),
		panVersion = 0,
		errorMessage = $bindable(''),
		waypoints = $bindable<Waypoint[]>([]),
		onMapClick
	}: {
		center?: [number, number];
		zoom?: number;
		radius?: number;
		tifBase64?: string;
		overlayOpacity?: number;
		loadingMessage?: string;
		panVersion?: number;
		errorMessage?: string;
		waypoints?: Waypoint[];
		onMapClick?: (lat: number, lon: number) => void;
	} = $props();
```

Changes:
- `overlayUrl` and `overlayBounds` removed
- `tifBase64` and `overlayOpacity` added
- `loadingMessage` changed from read-only to `$bindable`

- [ ] **Step 3: Update the overlay variable type**

Replace line 39:
```typescript
	let overlay: import('leaflet').ImageOverlay | undefined;
```

With:
```typescript
	let overlay = $state<import('leaflet').GridLayer | undefined>(undefined);
```

`$state` so the opacity `$effect` can react when it's set. `GridLayer` because `GeoRasterLayer` extends it.

- [ ] **Step 4: Replace the crop overlay $effect**

Replace the existing crop overlay effect (lines 152–166):

```typescript
	// Crop overlay — replaces previous overlay when overlayUrl/overlayBounds change
	$effect(() => {
		if (!mapReady || !map || !overlayUrl || !overlayBounds) return;
		if (overlay) {
			overlay.remove();
		}
		import('leaflet').then((L) => {
			overlay = L.imageOverlay(overlayUrl, overlayBounds!).addTo(
				map!
			);
			overlay.on('error', () => {
				errorMessage = 'Failed to load crop image — the data may not be available for this area';
			});
		});
	});
```

With:

```typescript
	// GeoTIFF overlay — decode, parse, and render when tifBase64 changes.
	// Uses $state overlay so the opacity $effect can track it.
	// Reads overlay and overlayOpacity via untrack() to avoid making them dependencies.
	$effect(() => {
		if (!mapReady || !map || !tifBase64) return;

		// Remove old overlay without tracking it as a dependency
		const oldOverlay = untrack(() => overlay);
		if (oldOverlay) {
			map!.removeLayer(oldOverlay);
			overlay = undefined;
		}

		const currentTif = tifBase64;

		(async () => {
			try {
				loadingMessage = 'Rendering crop overlay...';

				// Decode base64 to ArrayBuffer
				const binaryStr = atob(currentTif);
				const bytes = new Uint8Array(binaryStr.length);
				for (let i = 0; i < binaryStr.length; i++) {
					bytes[i] = binaryStr.charCodeAt(i);
				}

				// Dynamic imports (SSR safety + code splitting)
				const [parseGeoraster, GeoRasterLayer, proj4] = await Promise.all([
					import('georaster').then((m) => m.default),
					import('georaster-layer-for-leaflet').then((m) => m.default),
					import('proj4').then((m) => m.default)
				]);

				// Register EPSG:5070 for CDL raster reprojection
				const { EPSG_5070 } = await import('$lib/projections');
				proj4.defs('EPSG:5070', EPSG_5070);

				const georaster = await parseGeoraster(bytes.buffer);

				// Stale check — abort if a newer search arrived while parsing
				if (tifBase64 !== currentTif) return;

				const initialOpacity = untrack(() => overlayOpacity);
				const layer = new GeoRasterLayer({
					georaster,
					opacity: initialOpacity,
					resolution: 256,
					proj4
				});
				layer.addTo(map!);
				overlay = layer;
				loadingMessage = '';
			} catch (err) {
				console.error('GeoTIFF rendering error:', err);
				if (tifBase64 === currentTif) {
					loadingMessage = '';
					errorMessage = 'Failed to render crop overlay';
				}
			}
		})();
	});

	// Opacity — reactively update when the slider changes, without re-parsing the GeoTIFF
	$effect(() => {
		if (overlay) {
			overlay.setOpacity(overlayOpacity);
		}
	});
```

**Why two $effects:**
- The main $effect tracks only `mapReady`, `map`, and `tifBase64`. Changing opacity does NOT trigger re-parsing.
- The opacity $effect tracks `overlay` ($state) and `overlayOpacity`. When the user drags the slider, it calls `setOpacity()` — instant, no flicker.
- The main $effect reads `overlay` and `overlayOpacity` via `untrack()` to avoid making them dependencies.

- [ ] **Step 5: Verify the build compiles**

```bash
npm run check
```

Expected: Should compile. If `georaster-layer-for-leaflet` has Vite resolution issues, add to `vite.config.ts`:
```typescript
optimizeDeps: { include: ['georaster', 'georaster-layer-for-leaflet'] }
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/MapView.svelte
git commit -m "feat: replace PNG imageOverlay with GeoRasterLayer for zoom-independent rendering"
```

---

## Task 6: Opacity Slider with localStorage Persistence (TDD)

**Files:**
- Modify: `src/lib/localStorage.ts`
- Modify: `src/lib/localStorage.spec.ts`
- Create: `src/lib/components/OpacitySlider.svelte`

- [ ] **Step 1: Write the failing localStorage tests**

Add to `src/lib/localStorage.spec.ts`, inside the `describe('localStorage helpers')` block:

```typescript
	it('saves and retrieves overlay opacity', () => {
		saveOverlayOpacity(0.7, mockLocalStorage);
		expect(getOverlayOpacity(mockLocalStorage)).toBe(0.7);
	});

	it('returns null when no opacity saved', () => {
		expect(getOverlayOpacity(mockLocalStorage)).toBeNull();
	});
```

Add the imports at the top:
```typescript
import {
	// ... existing imports ...
	saveOverlayOpacity,
	getOverlayOpacity
} from './localStorage';
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `saveOverlayOpacity` and `getOverlayOpacity` don't exist yet.

- [ ] **Step 3: Implement opacity persistence in localStorage.ts**

In `src/lib/localStorage.ts`, add to the `KEYS` object:

```typescript
const KEYS = {
	location: 'ff-last-location',
	radius: 'ff-last-radius',
	crops: 'ff-crop-filters',
	sidebar: 'ff-sidebar-collapsed',
	waypoints: 'ff-waypoints',
	opacity: 'ff-overlay-opacity'
} as const;
```

Add the functions at the bottom:

```typescript
// Overlay opacity
export function saveOverlayOpacity(opacity: number, storage?: Storage): void {
	safeSet(KEYS.opacity, opacity, storage);
}
export function getOverlayOpacity(storage?: Storage): number | null {
	return safeGet(KEYS.opacity, storage);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Create the OpacitySlider component**

Create `src/lib/components/OpacitySlider.svelte`:

```svelte
<!-- src/lib/components/OpacitySlider.svelte -->
<script lang="ts">
	let { opacity = $bindable(0.7) }: { opacity?: number } = $props();
</script>

<div>
	<label for="opacity-slider" class="mb-1 block text-sm font-semibold text-gray-700">
		Overlay Opacity: {Math.round(opacity * 100)}%
	</label>
	<input
		id="opacity-slider"
		type="range"
		min="0"
		max="100"
		value={Math.round(opacity * 100)}
		oninput={(e) => (opacity = parseInt(e.currentTarget.value) / 100)}
		class="w-full"
	/>
</div>
```

Design mirrors `RadiusSlider.svelte`: label with current value, range input, Tailwind classes.

- [ ] **Step 6: Verify full build compiles and tests pass**

```bash
npm run check && npm test
```

Expected: All clear.

- [ ] **Step 7: Commit**

```bash
git add src/lib/localStorage.ts src/lib/localStorage.spec.ts src/lib/components/OpacitySlider.svelte
git commit -m "feat: add overlay opacity slider with localStorage persistence"
```

---

## Task 7: Area Summary — Crop Percentage Breakdown (TDD)

**Files:**
- Create: `src/lib/cropStats.ts`
- Create: `src/lib/cropStats.spec.ts`
- Create: `src/lib/components/AreaSummary.svelte`
- Modify: `src/lib/components/MapView.svelte`
- Modify: `src/routes/+page.svelte`

After parsing the GeoTIFF with `georaster`, we have `georaster.values[0]` — a 2D array of pixel values where each value is a CDL crop ID. Count occurrences of each ID, compute percentages, and display a summary panel. No server-side processing needed.

- [ ] **Step 1: Write the failing tests for cropStats**

Create `src/lib/cropStats.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeCropStats, type CropStat } from './cropStats';

describe('computeCropStats', () => {
	it('counts pixel values and returns sorted percentages', () => {
		// 3x3 grid: 4 corn, 3 sorghum, 2 nodata(0)
		const values = [
			[
				[1, 1, 4],
				[1, 4, 4],
				[0, 0, 1]
			]
		];
		const stats = computeCropStats(values, 0);

		// Excludes nodata (0), so total = 7
		expect(stats).toHaveLength(2);
		expect(stats[0]).toEqual({
			id: 1,
			name: 'Corn',
			color: '#FFFF00',
			count: 4,
			percentage: (4 / 7) * 100
		});
		expect(stats[1]).toEqual({
			id: 4,
			name: 'Sorghum',
			color: '#FF8C00',
			count: 3,
			percentage: (3 / 7) * 100
		});
	});

	it('labels unknown crop IDs as "Other (ID: <n>)"', () => {
		const values = [[[999, 999, 1]]];
		const stats = computeCropStats(values, 0);

		expect(stats[0]).toMatchObject({
			id: 999,
			name: 'Other (ID: 999)',
			color: '#C0C0C0',
			count: 2
		});
	});

	it('returns empty array for all-nodata raster', () => {
		const values = [[[0, 0], [0, 0]]];
		const stats = computeCropStats(values, 0);
		expect(stats).toEqual([]);
	});

	it('treats null noDataValue as no exclusion', () => {
		const values = [[[0, 0, 1]]];
		const stats = computeCropStats(values, null);

		expect(stats).toHaveLength(2);
		// 0 is included since noDataValue is null
		expect(stats.find((s) => s.id === 0)).toBeDefined();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `cropStats` module doesn't exist yet.

- [ ] **Step 3: Implement computeCropStats**

Create `src/lib/cropStats.ts`:

```typescript
import { getCropById } from './crops';

export interface CropStat {
	id: number;
	name: string;
	color: string;
	count: number;
	percentage: number;
}

/**
 * Count pixel values from a georaster and return sorted crop statistics.
 * @param values - georaster.values (band × row × col)
 * @param noDataValue - value to exclude (typically 0)
 */
export function computeCropStats(
	values: number[][][],
	noDataValue: number | null
): CropStat[] {
	const counts = new Map<number, number>();
	let total = 0;

	const band = values[0];
	for (const row of band) {
		for (const val of row) {
			if (noDataValue !== null && val === noDataValue) continue;
			counts.set(val, (counts.get(val) ?? 0) + 1);
			total++;
		}
	}

	if (total === 0) return [];

	const stats: CropStat[] = [];
	for (const [id, count] of counts) {
		const crop = getCropById(id);
		stats.push({
			id,
			name: crop ? crop.name : `Other (ID: ${id})`,
			color: crop ? crop.color : '#C0C0C0',
			count,
			percentage: (count / total) * 100
		});
	}

	// Sort descending by percentage
	stats.sort((a, b) => b.percentage - a.percentage);
	return stats;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5: Create the AreaSummary component**

Create `src/lib/components/AreaSummary.svelte`:

```svelte
<!-- src/lib/components/AreaSummary.svelte -->
<script lang="ts">
	import type { CropStat } from '$lib/cropStats';

	let { stats = [] }: { stats?: CropStat[] } = $props();
</script>

{#if stats.length > 0}
	<div>
		<h3 class="mb-2 text-sm font-semibold text-gray-700">Area Summary</h3>
		<ul class="space-y-1 text-sm">
			{#each stats as stat (stat.id)}
				<li class="flex items-center gap-2">
					<span
						class="inline-block h-3 w-3 shrink-0 rounded-sm"
						style="background-color: {stat.color}"
					></span>
					<span class="flex-1 truncate">{stat.name}</span>
					<span class="font-mono text-gray-600">{stat.percentage.toFixed(1)}%</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}
```

- [ ] **Step 6: Wire up crop stats in MapView**

In `src/lib/components/MapView.svelte`, after the georaster is parsed and the layer is added, compute the stats and expose them:

1. Add import at the top:
```typescript
import { computeCropStats, type CropStat } from '$lib/cropStats';
```

2. Add a `$state` variable alongside `overlay`:
```typescript
let cropStats = $state<CropStat[]>([]);
```

3. In the GeoTIFF `$effect`, after `overlay = layer;` and before `loadingMessage = '';`:
```typescript
					cropStats = computeCropStats(georaster.values, georaster.noDataValue);
```

4. Also clear stats when clearing overlay (in the cleanup section):
```typescript
			overlay = undefined;
			cropStats = [];
```

5. Add `cropStats` to the component's props as a `$bindable` output:

In the props destructuring, add:
```typescript
		cropStats = $bindable<CropStat[]>([]),
```

And in the props type:
```typescript
		cropStats?: CropStat[];
```

- [ ] **Step 7: Add AreaSummary to the sidebar in +page.svelte**

1. Add state and import:
```typescript
import AreaSummary from '$lib/components/AreaSummary.svelte';
import type { CropStat } from '$lib/cropStats';

let cropStats = $state<CropStat[]>([]);
```

2. Bind `cropStats` on `<MapView>`:
```svelte
			bind:cropStats
```

3. Add `<AreaSummary>` in the sidebar, after `<OpacitySlider>` and before `<SearchButton>`:
```svelte
			<AreaSummary stats={cropStats} />
```

- [ ] **Step 8: Verify build compiles and tests pass**

```bash
npm run check && npm test
```

Expected: All clear.

- [ ] **Step 9: Commit**

```bash
git add src/lib/cropStats.ts src/lib/cropStats.spec.ts src/lib/components/AreaSummary.svelte src/lib/components/MapView.svelte src/routes/+page.svelte
git commit -m "feat: add area summary with crop percentage breakdown from GeoTIFF data"
```

---

## Task 8: Integration Verification and Accuracy Check

**Files:** None (manual testing)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Smoke-test the GeoTIFF overlay**

1. Open `http://localhost:5173` in the browser
2. Click on the map near the test location (lat `40.553950`, lon `-100.076157` — Eustis, NE)
3. Set radius to 10 miles, year to 2024
4. Click Search
5. Verify: loading overlay shows progress steps → "Rendering crop overlay..." → overlay appears
6. Zoom in/out — verify the overlay stays sharp (no pixelation). This is the core improvement.

- [ ] **Step 3: Test opacity slider**

1. Drag the opacity slider from 100% down to ~30%
2. Verify: underlying map becomes visible through the crop overlay
3. Verify: opacity change is instant (no flicker, no re-parse)
4. Refresh the page — verify opacity is restored from localStorage

- [ ] **Step 4: Test area summary**

1. After a successful search, verify the Area Summary panel appears in the sidebar
2. Verify crop names, color swatches, and percentages are displayed
3. Verify percentages are sorted descending (largest crop first)
4. Run a new search — verify the summary updates with the new data
5. Verify unknown crop IDs (if any) show as "Other (ID: N)" with gray swatch

- [ ] **Step 5: Verify placement accuracy**

1. Set opacity to ~50% so you can see the map underneath the overlay
2. Look at recognizable features: rivers, roads, town boundaries
3. Check that the crop overlay aligns with the base map features
4. Compare with CropScape Explorer (`https://nassgeodata.gmu.edu/CropScape/`) for the same area

If overlay placement is noticeably off, potential causes:
- proj4 EPSG:5070 definition mismatch — verify the definition string matches what CDL uses
- GeoTIFF bounds vs requested bounds — with GeoRasterLayer this should be handled automatically
- Resolution artifacts — try higher `resolution` value (512)

Document any findings in `planning/features.md` under the accuracy item.

- [ ] **Step 6: Test edge cases**

1. Search with no crops selected (all crop data shown) — verify colors render correctly
2. Search with specific crops selected — verify only those crops are visible (rest transparent)
3. Search with a large radius (20+ miles) — verify the overlay renders without errors
4. Click Search again with different parameters — verify old overlay is replaced cleanly

- [ ] **Step 7: Test color rendering**

The CDL GeoTIFF should include an embedded color table (palette). Verify:
1. Crop colors match the legend (sorghum = orange, wheat = brown, etc.)
2. If colors look wrong (all gray, or random colors), the palette may not be read correctly

**If palette doesn't work**, add a `pixelValuesToColorFn` fallback in the GeoRasterLayer constructor (MapView.svelte):

```typescript
import { getCropById } from '$lib/crops';

// Inside the GeoRasterLayer constructor options:
pixelValuesToColorFn: (values: number[]) => {
	const val = values[0];
	if (val === 0) return null; // nodata → transparent
	const crop = getCropById(val);
	return crop ? crop.color : '#C0C0C0'; // Unknown crops → light gray
}
```

Only add this if the embedded palette doesn't work. Prefer the embedded palette because it has all 130+ CDL crop types colored correctly.

- [ ] **Step 8: Run all tests one final time**

```bash
npm run check && npm test
```

Expected: All pass, no type errors.

- [ ] **Step 9: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address issues found during integration testing"
```

---

## Troubleshooting Notes

### Vite/SvelteKit import issues with georaster packages

If `npm run dev` fails with module resolution errors for `georaster` or `georaster-layer-for-leaflet`, add them to Vite's dependency optimization in `vite.config.ts`:

```typescript
export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	optimizeDeps: {
		include: ['georaster', 'georaster-layer-for-leaflet']
	},
	// ... test config
});
```

### GeoTIFF too large for base64 SSE

If searches with radius > 30 miles fail or are extremely slow, the GeoTIFF may be too large to base64-encode in memory. Mitigation options (not in scope for this plan):
1. Add a separate `/api/proxy-tif` endpoint that streams the binary directly
2. Cap the effective resolution requested from CDL

### georaster-layer-for-leaflet can't find proj4

The library looks for proj4 via the `proj4` option passed to the constructor. If reprojection fails:
1. Verify `proj4.defs('EPSG:5070', ...)` is called before `parseGeoraster`
2. Try setting `window.proj4 = proj4` as a fallback (some versions check the global)
