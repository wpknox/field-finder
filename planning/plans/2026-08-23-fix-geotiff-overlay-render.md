# Fix GeoTIFF Overlay Rendering Implementation Plan

> **✅ COMPLETED 2026-08-23** — implemented, live-verified, and merged to `main` via PR #2 (`58d5a4c`). Historical record only.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CDL crop overlay render at full raster resolution with correct CDL palette colors, replacing the broken `georaster.toCanvas()` call.

**Architecture:** A new pure function converts the georaster pixel band + embedded palette into an RGBA byte array (unit-testable in vitest, no DOM). A thin browser helper wraps it in a canvas → data URL. `MapView.svelte` swaps its `toCanvas()` call for the helper; everything else (imageOverlay placement, opacity, crop stats) stays unchanged.

**Tech Stack:** SvelteKit (Svelte 5 runes), Leaflet `imageOverlay`, `georaster`, vitest.

---

## Root Cause (verified 2026-08-23)

The overlay DOES render, but as a blurry grayscale blob. `georaster.toCanvas()` (package `georaster-to-canvas`) has two fatal behaviors, confirmed in `node_modules/georaster-to-canvas/index.js`:

1. **Canvas capped at 100×100** by default (`Math.min(georaster.height, 100)`). Our rasters are ~335×339+, so the overlay is a downsampled thumbnail stretched across the whole bbox.
2. **Single-band rasters render as min/max-scaled grayscale** — the function never reads `georaster.palette`. CDL colors are impossible through it.

The decision-log claim that "toCanvas() renders once using the embedded CDL palette" is false; it was written while the CDL API was down, so it was never verified. Server pipeline (`/api/search` SSE → base64 tif) is confirmed working end-to-end.

Work happens in the existing worktree `.worktrees/feature-geotiff-overlay` on branch `feature/geotiff-overlay` (PR #2, still open/unmerged — `main` has NO GeoTIFF code).

---

### Task 1: Pure raster→RGBA conversion function

**Files:**

- Create: `src/lib/renderGeoraster.ts`
- Test: `src/lib/renderGeoraster.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/renderGeoraster.spec.ts
import { describe, it, expect } from 'vitest';
import { rasterToRgba } from './renderGeoraster';

const palette: Array<[number, number, number, number]> = new Array(256).fill([0, 0, 0, 255]);
palette[1] = [255, 212, 0, 255]; // corn
palette[5] = [38, 115, 0, 255]; // soybeans

describe('rasterToRgba', () => {
	it('maps pixel values to palette colors at full resolution', () => {
		const band = [
			[1, 5],
			[5, 1]
		];
		const rgba = rasterToRgba(band, 2, 2, 0, palette);
		expect(rgba.length).toBe(2 * 2 * 4);
		expect([...rgba.slice(0, 4)]).toEqual([255, 212, 0, 255]); // (0,0) = corn
		expect([...rgba.slice(4, 8)]).toEqual([38, 115, 0, 255]); // (0,1) = soybeans
	});

	it('renders noData pixels fully transparent', () => {
		const band = [[0]];
		const rgba = rasterToRgba(band, 1, 1, 0, palette);
		expect(rgba[3]).toBe(0);
	});

	it('renders values missing from the palette as transparent', () => {
		const band = [[7]];
		const rgba = rasterToRgba(band, 1, 1, 0, null);
		expect(rgba[3]).toBe(0);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/renderGeoraster.spec.ts`
Expected: FAIL — cannot resolve `./renderGeoraster`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/renderGeoraster.ts

/**
 * Convert a single-band raster into an RGBA byte array using the palette
 * embedded in the GeoTIFF (georaster.palette — 256 [r,g,b,a] entries indexed
 * by CDL value). noData and unmapped values become fully transparent so the
 * base map shows through.
 */
export function rasterToRgba(
	band: number[][],
	width: number,
	height: number,
	noDataValue: number | null,
	palette: Array<[number, number, number, number]> | null | undefined
): Uint8ClampedArray {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let row = 0; row < height; row++) {
		for (let col = 0; col < width; col++) {
			const val = band[row][col];
			const i = (row * width + col) * 4;
			if (val === noDataValue || !palette?.[val]) continue; // stays transparent (0,0,0,0)
			const [r, g, b, a] = palette[val];
			data[i] = r;
			data[i + 1] = g;
			data[i + 2] = b;
			data[i + 3] = a;
		}
	}
	return data;
}

/** Browser-only: paint the raster to a canvas at native resolution and return a PNG data URL. */
export function rasterToDataUrl(
	band: number[][],
	width: number,
	height: number,
	noDataValue: number | null,
	palette: Array<[number, number, number, number]> | null | undefined
): string {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	ctx.putImageData(
		new ImageData(rasterToRgba(band, width, height, noDataValue, palette), width, height),
		0,
		0
	);
	return canvas.toDataURL('image/png');
}
```

Note: CDL value 0 is background/noData. If the runtime `georaster.noDataValue` turns out to be `null`, value 0 still renders transparent only if the palette entry for 0 has alpha 0 — do NOT rely on that; the executing agent should `console.log(georaster.noDataValue, georaster.palette?.[0], georaster.palette?.[1])` once during Task 3 verification and, if `noDataValue` is null, pass `0` explicitly from MapView.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/renderGeoraster.spec.ts`
Expected: 3 passing

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: all tests pass (existing cropStats/crops/localStorage suites unaffected)

- [ ] **Step 6: Commit**

```bash
git add src/lib/renderGeoraster.ts src/lib/renderGeoraster.spec.ts
git commit -m "feat: palette-based full-resolution raster to RGBA conversion"
```

---

### Task 2: Wire into MapView

**Files:**

- Modify: `src/lib/components/MapView.svelte:194-195` (the `toCanvas()` lines inside the tifBase64 `$effect`)

- [ ] **Step 1: Replace toCanvas with rasterToDataUrl**

In the `$effect` that parses `tifBase64`, replace:

```ts
const canvas = (georaster as any).toCanvas();
const dataUrl = canvas.toDataURL('image/png');
```

with:

```ts
const dataUrl = rasterToDataUrl(
	georaster.values[0],
	georaster.width,
	georaster.height,
	georaster.noDataValue ?? 0,
	georaster.palette
);
```

and add to the imports at the top of the `<script>` block:

```ts
import { rasterToDataUrl } from '$lib/renderGeoraster';
```

Check `src/lib/types/georaster.d.ts`: it must declare `width: number`, `height: number`, `noDataValue: number | null`, and `palette?: Array<[number, number, number, number]>` on the georaster type. Add any that are missing there rather than casting `as any`.

- [ ] **Step 2: Lint + typecheck**

Run: `npm run lint && npm run check`
Expected: clean (or no NEW errors vs. main)

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/MapView.svelte src/lib/types/georaster.d.ts
git commit -m "fix: render CDL overlay at native resolution with embedded palette"
```

---

### Task 3: End-to-end verification (CDL API must be up)

The CDL API was up and working on 2026-08-23. If requests hang at "Fetching crop data...", the API is down again — pause and report, don't debug.

- [ ] **Step 1: Start dev server**

Run: `npm run dev -- --port 5199` (background), confirm `curl -s -o /dev/null -w '%{http_code}' http://localhost:5199/` → `200`

- [ ] **Step 2: Sanity-check the server pipeline**

```bash
curl -sN -m 120 -X POST http://localhost:5199/api/search -H 'Content-Type: application/json' \
  -d '{"lat":40.553950,"lon":-100.076157,"radius":3,"year":2023,"crops":[]}' | head -c 300
```

Expected: `progress` events then a `done` event whose `tifBase64` starts with `SUkq` (TIFF magic).

- [ ] **Step 3: Browser verification (Playwright MCP tools if available, otherwise manual browser + devtools console)**

1. Navigate to `http://localhost:5199/`.
2. Seed the test location: `localStorage.setItem('ff-last-location', JSON.stringify({lat:40.553950, lon:-100.076157}))` then reload.
3. Click the **Search** button; poll up to 60s for `document.querySelector('img.leaflet-image-layer')`.
4. Assert `img.naturalWidth > 300` and `img.naturalHeight > 300` (native raster size, NOT 100×100).
5. Log `georaster.noDataValue` / `palette[0]` / `palette[1]` per the Task 1 note if colors look wrong.
6. Take a screenshot. Expected: the overlay shows distinct CDL colors (yellow corn, green soybeans, etc.) inside the bounding-box rectangle — not a gray blob. Base map visible through background pixels.
7. Move the Overlay Opacity slider; overlay transparency changes instantly with no re-render delay.
8. Check the Area Summary section shows named crops with percentages.
9. Confirm zero console errors.

- [ ] **Step 4: Commit any verification-driven fixes**

One commit per fix, each with the failing observation in the message.

---

### Task 4: Sync living docs

**Files:**

- Modify: `memory/CONTEXT.md` (in the MAIN checkout `/Users/wpknox/Projects/field-finder`, since memory files live on main)
- Modify: `memory/decisions.md` (append-only)
- Modify: `planning/features.md`

- [ ] **Step 1: Correct CONTEXT.md**

Change PR #2 status from "fully working" to reflect reality: overlay now renders via custom `rasterToRgba`/`rasterToDataUrl` (full resolution + embedded palette); `georaster.toCanvas()` abandoned (100×100 cap, grayscale-only for single band).

- [ ] **Step 2: Append a decision entry**

```markdown
### [2026-08-23] Custom palette renderer replaces georaster.toCanvas()

**Decision:** Render the GeoTIFF with our own `rasterToRgba` (src/lib/renderGeoraster.ts): full-resolution canvas, colors looked up in `georaster.palette`, noData transparent.

**Reason:** `georaster-to-canvas` caps output at 100×100 and renders single-band rasters as min/max grayscale — it never reads the palette. The 2026-05-17 "hybrid render" decision assumed otherwise and was committed while the CDL API was down, so it was never verified. Confirmed live on 2026-08-23: blurry gray blob.

**Alternatives considered:** Passing `{width, height}` options to toCanvas (fixes resolution but still grayscale); patching georaster-to-canvas (external dep churn for 30 lines of code).
```

- [ ] **Step 3: Update features.md**

Update the GeoTIFF overlay entry; remove/annotate the "Image Overlay Placement Accuracy" idea only if verification showed placement is acceptable (small residual skew from painting an Albers raster onto a Mercator map is expected and stays as a known limitation).

- [ ] **Step 4: Commit docs**

```bash
git add memory/ planning/
git commit -m "docs: correct overlay status; log toCanvas root cause and custom renderer decision"
```

---

### Out of scope (user decisions, do not do)

- Merging PR #2 — after verification passes, use superpowers:finishing-a-development-branch and let the user choose.
- Reprojection-accurate overlay warping (Albers→Mercator per-pixel) — known limitation, separate feature.
- Verifying the 13 CROPS filter hex colors against `georaster.palette` — separate small task, now unblocked since the API is up.
