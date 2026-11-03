---
id: plan-audit-tranche-2a
type: planning
description: Implementation plan for audit tranche 2a — overlay hardening (F2 year in SearchResult, F1 cancellable overlay runs, F4 single owner of loadingMessage)
related:
  - planning/audit-2026-08-26.md
  - planning/plans/2026-08-26-audit-tranche-1.md
  - memory/CONTEXT.md
  - memory/decisions.md
  - planning/features.md
---

# Audit Tranche 2a — Overlay Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the search → overlay pipeline structurally safe before anything (year comparison, map layers, redesign) builds on it. That means fixing audit findings F2, F1 and F4 from `planning/audit-2026-08-26.md` on one branch and ending in a PR.

**Architecture:**

- **F1 (cancellable runs).** The overlay `$effect` in `MapView.svelte` currently relies on scattered identity checks to stop a stale render from reaching the map. It will delegate to a new pure module, `src/lib/overlayRun.ts`. `startOverlayRun()` drives one render from search result to attached layer and returns a `cancel()` handle. The effect returns that `cancel` as its teardown, so Svelte itself cancels the previous run whenever `searchResult` changes or the component unmounts:
  - a run cancelled mid-render never attaches;
  - a run cancelled after attaching removes its own layer.
- **F4 (one owner).** `+page.svelte` becomes the only writer of `loadingMessage`. MapView reports outcomes through `onRenderComplete` / `onRenderError` callbacks instead of writing the bindable.
- **F2.** `SearchResult` gains the search-time `year`, which the Area Summary header displays.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, TypeScript, Vitest (node environment only), Leaflet, georaster, Playwright MCP for live verification.

**Baseline (verify before starting):** `main` at `b1f83ec` (PR #3 merge), plus the plan commit. `npm test` 66/66, `npm run check` 0 errors, `npm run lint` clean. Branch `fix/audit-tranche-2a` already exists, cut from `b1f83ec`.

> **PR #4 (`feat/dove-quick-wins`) is open against `main` separately.** It touches `crops.ts`, `CropFilter.svelte`, `constants.ts` and the living docs, but **not** `MapView.svelte`, `+page.svelte`, `searchResult.ts` or `AreaSummary.svelte`. Code will not conflict. The living docs (`memory/CONTEXT.md`, `planning/features.md`, `memory/decisions.md`) will. **Before Task 5, check `gh pr view 4 --json state`. If it is MERGED, run `git rebase main` first. If it is still open, do the docs task anyway and expect to resolve a docs-only conflict later.**

---

## Scope

| Audit ID | What                                                                                     | Task   |
| -------- | ---------------------------------------------------------------------------------------- | ------ |
| F2       | `SearchResult` has no `year`; year comparison will need it                               | Task 1 |
| F1       | A render that finishes after a newer result arrives can orphan its layer on the map      | Task 2 |
| F4       | `loadingMessage` is written by both `+page.svelte` and `MapView.svelte`; no single owner | Task 3 |

**F2 scope decision:** add `year` only, not `crops`. The handoff and the tranche 2 table both scope F2 to `year`. Nothing consumes the crop list yet, and YAGNI applies. `year` gets a real consumer now: the Area Summary header shows which year it describes. That matters because the year dropdown can be changed after a search without re-searching, and the summary would then silently describe a year the dropdown no longer shows.

**Explicitly out of scope:** F3 + C4 (SSE payload validation, planned as 2b), B6, B7, C2–C7, D1–D5, the year comparison feature itself, and the map-layers spec.

## Testing Reality Check

- **Tests run in Node only.** The vitest config has a single `server` project in a Node environment and no component-test setup. `$effect` wiring cannot be unit-tested here.
- **That is why F1's logic moves into `overlayRun.ts`.** The cancellation logic is plain TypeScript with injected dependencies, so it gets real red-green tests (Task 2). The Svelte wiring around it is verified live (Task 4).
- **The F1 race is practically unreachable on `main`.** The window between the last identity guard (`MapView.svelte:211`) and `layer.addTo` (`:238`) spans only a synchronous canvas paint and an `await import('leaflet')` of an already-cached module, which is roughly one microtask. A new SSE event is a macrotask, so it cannot land there. Do **not** spend time trying to reproduce the orphan in a browser on `main`. The unit tests in Task 2 are the evidence for the race. The live double-result test in Task 4 checks the new wiring ends in a correct state.
- **F2 is checked by the type checker.** Adding a required field makes `npm run check` fail at every place a `SearchResult` is built. That failing check is the red step.
- **F4 is verified live,** including the render-error path (via a stubbed `/api/search`).

**Test location** (from `CLAUDE.md`): lat `40.553950`, lon `-100.076157`.

**CDL status:** healthy as of 2026-11-02 (~13 s per request, serving 2025). If it is hanging when Task 4 runs:

- run the stubbed-fetch steps (4c, 4d), which need no CDL;
- **stop and report** the real-CDL steps (4a, 4b) as not run;
- do not mark them passed.

## File Structure

| File                                                               | Change     | Responsibility                                                                                    |
| ------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------- |
| `src/lib/searchResult.ts`                                          | Modify     | Add `year` to the snapshot type                                                                   |
| `src/lib/components/AreaSummary.svelte`                            | Modify     | Optional `year` prop shown in the header                                                          |
| `src/lib/overlayRun.ts`                                            | **Create** | `startOverlayRun()` — one cancellable render, from result to attached layer                       |
| `src/lib/overlayRun.spec.ts`                                       | **Create** | Unit tests for every cancellation point                                                           |
| `src/lib/components/MapView.svelte`                                | Modify     | Overlay effect delegates to `startOverlayRun` and returns its cancel; reports via callbacks       |
| `src/routes/+page.svelte`                                          | Modify     | Snapshot `year`; sole owner of `loadingMessage`; handle render callbacks; `$state.raw` for result |
| `planning/audit-2026-08-26.md`                                     | Modify     | Mark F1, F2, F4 `[FIXED …]`                                                                       |
| `memory/CONTEXT.md`, `memory/decisions.md`, `planning/features.md` | Modify     | Living-doc sync                                                                                   |

---

## Task 0: Baseline

**Files:** none

- [ ] **Step 1: Confirm branch and clean tree**

```bash
git branch --show-current   # expect: fix/audit-tranche-2a
git status --short          # expect: clean
git log --oneline -1 main   # expect: b1f83ec Merge pull request #3 ...
```

- [ ] **Step 2: Confirm the baseline is green**

```bash
npm test 2>&1 | grep -E 'Tests '      # expect: 66 passed (66)
npm run check 2>&1 | tail -1          # expect: 0 ERRORS 0 WARNINGS
npm run lint >/dev/null 2>&1; echo $? # expect: 0
```

If any of these fail, stop and report. Do not start on a red baseline.

- [ ] **Step 3: The plan is already committed** by the orchestrator, prettier-formatted, so `npm run lint` is green at baseline. If `git log --oneline -1` does not show `docs: plan for audit tranche 2a`, stop and report.

---

## Task 1: F2 — `SearchResult` carries the search-time year

**Files:**

- Modify: `src/lib/searchResult.ts`
- Modify: `src/routes/+page.svelte:118-171` (`handleSearch`) and `:202` (`<AreaSummary>`)
- Modify: `src/lib/components/AreaSummary.svelte`

- [ ] **Step 1: Add the field to the type (this is the "failing test")**

In `src/lib/searchResult.ts`, add after the `radius` field:

```ts
/** Search-time CDL year — the year this raster actually shows. */
year: number;
```

Also extend the interface's doc comment. Change its first paragraph to:

```ts
/**
 * A completed CDL search, snapshotted at request time.
 *
 * lat/lon/radius/year are captured BEFORE the request is sent, so the overlay is
 * always placed over the bbox that was actually searched — and labelled with the
 * year that was actually fetched — even if the user moves the marker, the radius
 * slider, or the year dropdown while the fetch is in flight.
```

(leave the second paragraph, about fresh identity, unchanged).

- [ ] **Step 2: Run the type checker, confirm it fails**

```bash
npm run check 2>&1 | grep -E "Error|year" | head
```

Expected: an error in `src/routes/+page.svelte` saying property `year` is missing in the object assigned to `searchResult`.

- [ ] **Step 3: Snapshot the year in `handleSearch`**

In `src/routes/+page.svelte`, extend the snapshot block (currently lines 118–123):

```ts
// Snapshot the search parameters up front — the user is free to move the
// marker, the radius slider, or the year dropdown while the multi-second
// fetch is in flight, and the overlay must reflect the search that happened.
const searchLat = mapCenter[0];
const searchLon = mapCenter[1];
const searchRadius = radius;
const searchYear = year;
```

In the request body, replace `year,` with `year: searchYear,`.

In the `done` branch, add `year: searchYear` to the object:

```ts
searchResult = {
	tifBase64: event.tifBase64,
	lat: searchLat,
	lon: searchLon,
	radius: searchRadius,
	year: searchYear
};
```

- [ ] **Step 4: Show the year in the Area Summary header**

Replace the `<script>` block of `src/lib/components/AreaSummary.svelte` with:

```svelte
<script lang="ts">
	import type { CropStat } from '$lib/cropStats';

	// `year` is the year of the raster these stats were computed from (the
	// search-time snapshot), which may differ from the year dropdown if the user
	// changed it without searching again.
	let { stats = [], year }: { stats?: CropStat[]; year?: number } = $props();
	let open = $state(true);
</script>
```

and replace `<span>Area Summary</span>` with:

```svelte
<span
	>Area Summary{#if year !== undefined}&nbsp;·&nbsp;{year}{/if}</span
>
```

In `src/routes/+page.svelte`, change `<AreaSummary stats={cropStats} />` to:

```svelte
<AreaSummary stats={cropStats} year={searchResult?.year} />
```

- [ ] **Step 5: Verify green**

```bash
npm run check 2>&1 | tail -1          # expect: 0 ERRORS 0 WARNINGS
npm test 2>&1 | grep -E 'Tests '      # expect: 66 passed (66)
npx prettier --check src >/dev/null; echo $?   # expect: 0 (run `npx prettier --write` on touched files if not)
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/searchResult.ts src/routes/+page.svelte src/lib/components/AreaSummary.svelte
git commit -m "fix: snapshot the search year in SearchResult and label Area Summary with it (audit F2)"
```

---

## Task 2: F1 — `startOverlayRun`, a cancellable render (pure module, TDD)

**Files:**

- Create: `src/lib/overlayRun.ts`
- Create: `src/lib/overlayRun.spec.ts`

The module knows nothing about Leaflet or georaster. Everything slow or side-effecting is injected, which is what makes every cancellation point testable in Node.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/overlayRun.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { startOverlayRun, type OverlayRunDeps } from './overlayRun';
import type { SearchResult } from './searchResult';

/** A promise plus its resolve/reject, so a test controls exactly when each step settles. */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const RESULT: SearchResult = {
	tifBase64: 'AAAA',
	lat: 40.55395,
	lon: -100.076157,
	radius: 10,
	year: 2025
};

type FakeLayer = { name: string };

function makeDeps() {
	const rendered = deferred<string>();
	const created = deferred<FakeLayer>();
	// Mocks are typed through vi.fn's generic rather than with named-but-unused
	// parameters: eslint.config.js has no argsIgnorePattern, so `_param` names fail lint.
	const deps = {
		render: vi.fn<(result: SearchResult) => Promise<string>>(() => rendered.promise),
		createLayer: vi.fn<(rendered: string) => Promise<FakeLayer>>(() => created.promise),
		attach: vi.fn<(layer: FakeLayer) => void>(),
		detach: vi.fn<(layer: FakeLayer) => void>(),
		onComplete: vi.fn<(rendered: string, layer: FakeLayer) => void>(),
		onError: vi.fn<(err: unknown) => void>()
	} satisfies OverlayRunDeps<string, FakeLayer>;
	return { deps, rendered, created };
}

describe('startOverlayRun', () => {
	it('renders the result, attaches the layer, then reports completion', async () => {
		const { deps, rendered, created } = makeDeps();
		const layer = { name: 'L1' };

		const run = startOverlayRun(RESULT, deps);
		rendered.resolve('png-data');
		created.resolve(layer);
		await run.finished;

		expect(deps.render).toHaveBeenCalledWith(RESULT);
		expect(deps.createLayer).toHaveBeenCalledWith('png-data');
		expect(deps.attach).toHaveBeenCalledExactlyOnceWith(layer);
		expect(deps.onComplete).toHaveBeenCalledExactlyOnceWith('png-data', layer);
		expect(deps.detach).not.toHaveBeenCalled();
		expect(deps.onError).not.toHaveBeenCalled();
	});

	// The F1 race: a newer search result arrives while this one is still parsing.
	it('never attaches when cancelled while rendering', async () => {
		const { deps, rendered, created } = makeDeps();

		const run = startOverlayRun(RESULT, deps);
		run.cancel();
		rendered.resolve('png-data');
		created.resolve({ name: 'L1' });
		await run.finished;

		expect(deps.createLayer).not.toHaveBeenCalled();
		expect(deps.attach).not.toHaveBeenCalled();
		expect(deps.onComplete).not.toHaveBeenCalled();
		expect(deps.onError).not.toHaveBeenCalled();
	});

	// The exact window the audit describes: past the parse, before addTo.
	it('never attaches when cancelled while the layer is being created', async () => {
		const { deps, rendered, created } = makeDeps();

		const run = startOverlayRun(RESULT, deps);
		rendered.resolve('png-data');
		await vi.waitFor(() => expect(deps.createLayer).toHaveBeenCalled());
		run.cancel();
		created.resolve({ name: 'L1' });
		await run.finished;

		expect(deps.attach).not.toHaveBeenCalled();
		expect(deps.onComplete).not.toHaveBeenCalled();
	});

	it('removes its own layer when cancelled after attaching', async () => {
		const { deps, rendered, created } = makeDeps();
		const layer = { name: 'L1' };

		const run = startOverlayRun(RESULT, deps);
		rendered.resolve('png-data');
		created.resolve(layer);
		await run.finished;
		run.cancel();

		expect(deps.detach).toHaveBeenCalledExactlyOnceWith(layer);
	});

	it('detaches only once when cancelled repeatedly', async () => {
		const { deps, rendered, created } = makeDeps();

		const run = startOverlayRun(RESULT, deps);
		rendered.resolve('png-data');
		created.resolve({ name: 'L1' });
		await run.finished;
		run.cancel();
		run.cancel();

		expect(deps.detach).toHaveBeenCalledTimes(1);
	});

	it('reports a render failure and attaches nothing', async () => {
		const { deps, rendered } = makeDeps();
		const failure = new Error('not a tif');

		const run = startOverlayRun(RESULT, deps);
		rendered.reject(failure);
		await run.finished;

		expect(deps.onError).toHaveBeenCalledExactlyOnceWith(failure);
		expect(deps.attach).not.toHaveBeenCalled();
		expect(deps.onComplete).not.toHaveBeenCalled();
	});

	it('stays silent about a failure that happens after cancellation', async () => {
		const { deps, rendered } = makeDeps();

		const run = startOverlayRun(RESULT, deps);
		run.cancel();
		rendered.reject(new Error('not a tif'));
		await run.finished;

		expect(deps.onError).not.toHaveBeenCalled();
	});

	it('catches a synchronous throw from render', async () => {
		const { deps } = makeDeps();
		const failure = new Error('atob failed');
		deps.render.mockImplementation(() => {
			throw failure;
		});

		const run = startOverlayRun(RESULT, deps);
		await run.finished;

		expect(deps.onError).toHaveBeenCalledExactlyOnceWith(failure);
	});
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run src/lib/overlayRun.spec.ts 2>&1 | tail -5
```

Expected: FAIL. The suite cannot import `./overlayRun` (module does not exist).

- [ ] **Step 3: Implement `src/lib/overlayRun.ts`**

```ts
import type { SearchResult } from './searchResult';

/**
 * Everything slow or side-effecting that one overlay render needs, injected so
 * the cancellation logic below can be unit-tested without Leaflet or georaster.
 */
export interface OverlayRunDeps<Rendered, Layer> {
	/** Decode, parse, and paint the raster. Slow — seconds for a large search. */
	render(result: SearchResult): Promise<Rendered>;
	/** Build the map layer for a rendered raster. Must NOT add it to the map. */
	createLayer(rendered: Rendered): Promise<Layer>;
	/** Put the layer on the map. */
	attach(layer: Layer): void;
	/** Take the layer off the map. */
	detach(layer: Layer): void;
	/** Called once, after attach — never for a cancelled run. */
	onComplete(rendered: Rendered, layer: Layer): void;
	/** Called once on failure — never for a cancelled run. */
	onError(err: unknown): void;
}

export interface OverlayRun {
	/**
	 * Abandon this run. A run still rendering will never attach; a run that has
	 * already attached removes its layer. Safe to call more than once.
	 */
	cancel(): void;
	/** Settles when the run completes, fails, or notices it was cancelled. Never rejects. */
	finished: Promise<void>;
}

/**
 * Render one search result onto the map, cancellably.
 *
 * MapView starts one run per `searchResult` and returns `run.cancel` as the
 * `$effect` teardown, so Svelte cancels the previous run whenever a new result
 * arrives or the map unmounts. That replaces the scattered identity checks that
 * could leave a layer orphaned on the map when two renders overlapped (audit F1):
 * cancellation is checked after every await, and a layer that made it onto the
 * map is owned by the run that put it there.
 *
 * Note: `deps.render` is invoked synchronously, before this function returns.
 * Callers inside a Svelte `$effect` should wrap the call in `untrack()` so that
 * nothing render reads becomes a dependency of the effect.
 */
export function startOverlayRun<Rendered, Layer>(
	result: SearchResult,
	deps: OverlayRunDeps<Rendered, Layer>
): OverlayRun {
	let cancelled = false;
	let attached: Layer | undefined;

	const finished = (async () => {
		try {
			const rendered = await deps.render(result);
			if (cancelled) return;
			const layer = await deps.createLayer(rendered);
			if (cancelled) return;
			deps.attach(layer);
			attached = layer;
			deps.onComplete(rendered, layer);
		} catch (err) {
			if (!cancelled) deps.onError(err);
		}
	})();

	return {
		cancel() {
			if (cancelled) return;
			cancelled = true;
			if (attached !== undefined) {
				deps.detach(attached);
				attached = undefined;
			}
		},
		finished
	};
}
```

- [ ] **Step 4: Run and confirm green**

```bash
npx vitest run src/lib/overlayRun.spec.ts 2>&1 | grep -E 'Tests '   # expect: 8 passed (8)
npm test 2>&1 | grep -E 'Tests '                                    # expect: 74 passed (74)
npm run check 2>&1 | tail -1                                        # expect: 0 ERRORS 0 WARNINGS
npm run lint >/dev/null 2>&1; echo $?                               # expect: 0
```

(Plan review 2026-11-02 applied this spec to a scratch copy: 8/8 pass, eslint clean, svelte-check 0 errors.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/overlayRun.ts src/lib/overlayRun.spec.ts
git commit -m "feat: startOverlayRun — a cancellable overlay render with unit tests (audit F1)"
```

---

## Task 3: Wire MapView to `startOverlayRun` and give `loadingMessage` one owner (F1 + F4)

**Files:**

- Modify: `src/lib/components/MapView.svelte` (imports; props `:19-45`; overlay effect `:171-249`)
- Modify: `src/routes/+page.svelte` (`searchResult` declaration `:41`; `handleSearch` done branch + `finally`; new handlers; `<MapView>` props `:206-219`)

F1 wiring and F4 are one task because the run's `onComplete`/`onError` callbacks are exactly where `loadingMessage` ownership changes hands. Splitting them would mean writing MapView's `loadingMessage` writes into the new callbacks only to delete them in the next commit.

- [ ] **Step 1: MapView — imports**

Add to the imports in `MapView.svelte`:

```ts
import { startOverlayRun } from '$lib/overlayRun';
```

- [ ] **Step 2: MapView — props**

1. `loadingMessage` becomes a plain read-only prop. Replace `loadingMessage = $bindable(''),` with `loadingMessage = '',`.
2. Add two callbacks after `onMapClick` in the destructuring:

```text
		onMapClick,
		onRenderComplete,
		onRenderError
```

and in the type annotation after `onMapClick?: ...`:

```ts
		/** A search result finished rendering and its overlay is on the map. */
		onRenderComplete?: (result: SearchResult) => void;
		/** A search result could not be rendered. */
		onRenderError?: (result: SearchResult) => void;
```

`errorMessage` stays `$bindable`. The `ErrorToast` dismiss still writes it, but MapView no longer sets it for render failures.

- [ ] **Step 3: MapView — replace the overlay effect**

Delete the whole block from the comment `// GeoTIFF overlay — decode, parse, render...` (line 171) through the closing `});` of that effect (line 249). Replace it with:

```ts
interface RenderedRaster {
	dataUrl: string;
	bounds: [[number, number], [number, number]];
	stats: CropStat[];
	palette: CdlPalette | null;
}

/**
 * Decode, parse, and paint one search result. Reads nothing from component
 * state — the overlay is placed with the snapshot's own lat/lon/radius (audit
 * B2), never the live center/radius.
 */
async function renderSearchResult(result: SearchResult): Promise<RenderedRaster> {
	const binaryStr = atob(result.tifBase64);
	const bytes = new Uint8Array(binaryStr.length);
	for (let i = 0; i < binaryStr.length; i++) {
		bytes[i] = binaryStr.charCodeAt(i);
	}

	const parseGeoraster = await import('georaster').then((m) => m.default);
	const georaster = await parseGeoraster(bytes.buffer);

	// CDL value 0 is background, but georaster.noDataValue is null and
	// palette[0] is opaque black — so null must be normalized to 0, or
	// background pixels paint black on the map and get counted as a crop.
	const noData = georaster.noDataValue ?? 0;

	const bbox = computeBboxLatLon(result.lat, result.lon, result.radius);
	return {
		dataUrl: rasterToDataUrl(
			georaster.values[0],
			georaster.width,
			georaster.height,
			noData,
			georaster.palette
		),
		bounds: [
			[bbox.south, bbox.west],
			[bbox.north, bbox.east]
		],
		stats: computeCropStats(georaster.values, noData, georaster.palette),
		palette: georaster.palette ?? null
	};
}

// GeoTIFF overlay — one cancellable run per search result (src/lib/overlayRun.ts).
// The teardown cancels the run, and Svelte calls it whenever searchResult changes
// or the map unmounts. A run still parsing therefore never reaches the map, and a
// run whose layer is already up removes it. This replaces the identity checks that
// could orphan a layer when two renders overlapped (audit F1). A fresh result
// object per search still guarantees a re-run on byte-identical data (audit B3).
//
// Outcomes are reported to the page, which is the only writer of loadingMessage
// (audit F4).
$effect(() => {
	if (!mapReady || !map || !searchResult) return;
	const result = searchResult;
	const targetMap = map;

	// untrack: startOverlayRun calls render() synchronously, and nothing it
	// reads may become a dependency of this effect — only mapReady/searchResult.
	const run = untrack(() =>
		startOverlayRun<RenderedRaster, import('leaflet').ImageOverlay>(result, {
			render: renderSearchResult,
			createLayer: async ({ dataUrl, bounds }) => {
				const L = await import('leaflet');
				return L.imageOverlay(dataUrl, bounds, { opacity: untrack(() => overlayOpacity) });
			},
			attach: (layer) => {
				layer.addTo(targetMap);
			},
			detach: (layer) => {
				layer.remove();
			},
			onComplete: (rendered, layer) => {
				overlay = layer;
				cropStats = rendered.stats;
				cropPalette = rendered.palette;
				onRenderComplete?.(result);
			},
			onError: (err) => {
				console.error('GeoTIFF rendering error:', err);
				onRenderError?.(result);
			}
		})
	);

	return () => {
		run.cancel();
		overlay = undefined;
		// cropPalette is deliberately NOT cleared: the CDL colormap is near-constant,
		// and clearing it would flicker the swatches back to fallbacks mid-search.
		cropStats = [];
	};
});
```

Notes for the implementer:

- `layer.remove()` rather than `map.removeLayer(layer)`: the layer owns its own removal, and `detach` does not need to close over the map. On unmount, the `onMount` cleanup's `map.remove()` already removes every layer, and a later `layer.remove()` is a no-op. Both are safe in Leaflet 1.9.4; this is about clarity, not a crash.
- The comment block above the old effect said "Reads overlay and overlayOpacity via untrack()". The effect no longer reads `overlay` at all, which is intended. Do not re-add an `untrack(() => overlay)`.
- The opacity effect (`if (overlay) overlay.setOpacity(...)`) is unchanged and keeps working because `onComplete` assigns `overlay`.

- [ ] **Step 4: Page — store the result as a raw (unproxied) snapshot**

In `+page.svelte`, change:

```ts
let searchResult = $state<SearchResult | null>(null);
```

to:

```ts
// $state.raw: a SearchResult is an immutable snapshot that is only ever
// replaced, never mutated, so there is no reason to deep-proxy it (or the
// multi-megabyte base64 string inside). Reassignment still triggers MapView's
// overlay effect, and identity comparisons stay plain object identity.
let searchResult = $state.raw<SearchResult | null>(null);
```

- [ ] **Step 5: Page — the page owns `loadingMessage` end to end**

In `handleSearch`'s `done` branch, set the rendering message when handing off:

```ts
						} else if (event.type === 'done') {
							searchResult = {
								tifBase64: event.tifBase64,
								lat: searchLat,
								lon: searchLon,
								radius: searchRadius,
								year: searchYear
							};
							loadingMessage = 'Rendering crop overlay...';
							handedOffToMap = true;
```

Replace the comment inside `finally`:

```ts
		} finally {
			// Once a result is handed to MapView, the page keeps showing
			// "Rendering crop overlay..." until MapView reports back through
			// handleRenderComplete / handleRenderError.
			if (!handedOffToMap) {
				loadingMessage = '';
			}
		}
```

Add these two functions directly after `handleSearch`:

```ts
// MapView reports how rendering a search result went. The page is the only
// writer of loadingMessage (audit F4). MapView cancels superseded runs, so a
// report about a stale result should never arrive. The identity guard is
// defense in depth: a newer search owns the message, and a stale report must
// not clear it.
function handleRenderComplete(result: SearchResult) {
	if (result !== searchResult) return;
	loadingMessage = '';
}

function handleRenderError(result: SearchResult) {
	if (result !== searchResult) return;
	loadingMessage = '';
	errorMessage = 'Failed to render crop overlay';
}
```

- [ ] **Step 6: Page — update `<MapView>` props**

Change `bind:loadingMessage` to `{loadingMessage}`, and add the two callbacks:

```svelte
<MapView
	bind:center={mapCenter}
	zoom={mapZoom}
	{radius}
	{searchResult}
	{overlayOpacity}
	{loadingMessage}
	{panVersion}
	bind:errorMessage
	bind:waypoints
	bind:cropStats
	bind:cropPalette
	onMapClick={handleMapClick}
	onRenderComplete={handleRenderComplete}
	onRenderError={handleRenderError}
/>
```

- [ ] **Step 7: Confirm MapView no longer writes `loadingMessage`**

```bash
grep -n "loadingMessage" src/lib/components/MapView.svelte
```

Expected: exactly four hits:

- the prop default (`loadingMessage = '',`);
- the type annotation (`loadingMessage?: string;`);
- the effect comment ("…the only writer of loadingMessage (audit F4)");
- `<LoadingOverlay message={loadingMessage} />`.

Also run `grep -n "loadingMessage =" src/lib/components/MapView.svelte`. It must return only the prop default. Any other assignment means F4 is not done.

- [ ] **Step 8: Static checks**

```bash
npm run check 2>&1 | tail -1                  # expect: 0 ERRORS 0 WARNINGS
npm test 2>&1 | grep -E 'Tests '              # expect: 74 passed (74)
npx prettier --write src/lib/components/MapView.svelte src/routes/+page.svelte >/dev/null
npm run lint >/dev/null 2>&1; echo $?         # expect: 0
```

`CropStat`, `CdlPalette` and `untrack` are already imported in MapView (lines 2, 8–9); do not add duplicate imports.

- [ ] **Step 9: Commit** (live verification follows in Task 4, before the PR)

```bash
git add src/lib/components/MapView.svelte src/routes/+page.svelte
git commit -m "fix: overlay effect cancels superseded renders; page is sole owner of loadingMessage (audit F1, F4)"
```

---

## Task 3b: A non-TIFF or hung parse must fail, not hang (found in Task 4, added 2026-11-02)

**Why this task exists.** The live check in Task 4d stubbed a `done` event whose payload was `btoa('not a tif')`. The app stuck on "Rendering crop overlay…" forever, with Search disabled.

**Root cause** (confirmed in `node_modules/georaster/src/index.js:115-146`, georaster 1.6.0). In the browser, georaster parses in a Web Worker. It sets `worker.onmessage` and never sets `worker.onerror`. When the worker throws (console: `TypeError: Invalid byte order value` from a `blob:` worker), the `parseGeoraster()` promise never settles. So `renderSearchResult` never rejects, `startOverlayRun` never calls `onError`, and the page never clears `loadingMessage`.

This is not a regression: `main` awaits the same promise with no timeout. It is realistic, because the flaky USDA service could hand back an HTML/XML error page where the raster should be. wpknox chose to fix it in this branch.

**Fix: two guards, both in a new pure module so they are unit-testable in Node.**

1. **`isTiff(bytes)`.** Check the TIFF magic number before parsing:
   - `II*\0` (49 49 2A 00), little-endian classic TIFF;
   - `MM\0*` (4D 4D 00 2A), big-endian classic TIFF;
   - the BigTIFF variants with 0x2B in place of 0x2A.

   A non-TIFF then fails instantly with a clear error.

2. **`withTimeout(promise, ms, message)`.** A backstop, so that _any_ parse that never settles rejects after `RASTER_PARSE_TIMEOUT_MS = 60_000`. That is generous: a 50-mile raster parses in seconds. The timer is cleared when the promise settles, so nothing leaks.

Both errors flow through the existing path:

`renderSearchResult` rejects → `startOverlayRun` → `onError` → `onRenderError` → the page sets the "Failed to render crop overlay" toast and clears loading.

**Files:**

- Create: `src/lib/rasterGuards.ts`
- Create: `src/lib/rasterGuards.spec.ts`
- Modify: `src/lib/components/MapView.svelte` (imports; `renderSearchResult`)

- [ ] **Step 1: Write the failing tests** — create `src/lib/rasterGuards.spec.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isTiff, withTimeout, RASTER_PARSE_TIMEOUT_MS } from './rasterGuards';

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new TextEncoder().encode(s);

describe('isTiff', () => {
	it('accepts little-endian TIFF (II*\\0)', () => {
		expect(isTiff(bytes(0x49, 0x49, 0x2a, 0x00, 0x08, 0x00))).toBe(true);
	});

	it('accepts big-endian TIFF (MM\\0*)', () => {
		expect(isTiff(bytes(0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x08))).toBe(true);
	});

	it('accepts BigTIFF in both byte orders', () => {
		expect(isTiff(bytes(0x49, 0x49, 0x2b, 0x00))).toBe(true);
		expect(isTiff(bytes(0x4d, 0x4d, 0x00, 0x2b))).toBe(true);
	});

	// What a misbehaving upstream actually returns in place of a raster.
	it('rejects HTML, XML, and plain text', () => {
		expect(isTiff(ascii('<!DOCTYPE html><html>'))).toBe(false);
		expect(isTiff(ascii('<?xml version="1.0"?>'))).toBe(false);
		expect(isTiff(ascii('not a tif'))).toBe(false);
	});

	it('rejects input shorter than the 4-byte header', () => {
		expect(isTiff(bytes())).toBe(false);
		expect(isTiff(bytes(0x49, 0x49, 0x2a))).toBe(false);
	});

	it('rejects a mixed byte-order marker', () => {
		expect(isTiff(bytes(0x49, 0x4d, 0x2a, 0x00))).toBe(false);
	});
});

describe('withTimeout', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('resolves with the value when the promise settles in time', async () => {
		await expect(withTimeout(Promise.resolve('ok'), 1000, 'too slow')).resolves.toBe('ok');
	});

	it('passes through a rejection from the promise', async () => {
		const failure = new Error('bad');
		await expect(withTimeout(Promise.reject(failure), 1000, 'too slow')).rejects.toBe(failure);
	});

	// The georaster Web Worker case: a promise that never settles.
	it('rejects with the given message when the promise never settles', async () => {
		vi.useFakeTimers();
		const pending = withTimeout(new Promise<never>(() => {}), 5000, 'Raster parse timed out');
		const assertion = expect(pending).rejects.toThrow('Raster parse timed out');
		await vi.advanceTimersByTimeAsync(5000);
		await assertion;
	});

	it('does not reject before the timeout elapses', async () => {
		vi.useFakeTimers();
		let settled = false;
		withTimeout(new Promise<never>(() => {}), 5000, 'x').catch(() => {
			settled = true;
		});
		await vi.advanceTimersByTimeAsync(4999);
		expect(settled).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(settled).toBe(true);
	});

	it('clears its timer once the promise settles', async () => {
		vi.useFakeTimers();
		await withTimeout(Promise.resolve(1), 5000, 'x');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('defaults to a generous parse timeout', () => {
		expect(RASTER_PARSE_TIMEOUT_MS).toBe(60_000);
	});
});
```

- [ ] **Step 2: Run, confirm failure**

```bash
npx vitest run src/lib/rasterGuards.spec.ts 2>&1 | tail -5
```

Expected: FAIL. The suite cannot import `./rasterGuards`. Observe this with the module genuinely absent: write the spec first and the implementation second.

- [ ] **Step 3: Implement `src/lib/rasterGuards.ts`**

```ts
/**
 * Guards around parsing a CDL raster in the browser.
 *
 * georaster 1.6.0 parses in a Web Worker and never listens for worker errors
 * (node_modules/georaster/src/index.js sets onmessage, not onerror). A payload
 * the worker cannot parse therefore produces a promise that NEVER settles, and
 * the app would sit on "Rendering crop overlay…" forever. These guards turn
 * both failure shapes into ordinary rejections that the overlay run reports.
 */

/** Generous: a 50-mile raster parses in seconds. Only a hung parse hits this. */
export const RASTER_PARSE_TIMEOUT_MS = 60_000;

/**
 * True when `bytes` starts with a TIFF or BigTIFF header: byte-order mark
 * `II` (little-endian) or `MM` (big-endian), then magic 42 (TIFF) or 43
 * (BigTIFF) in that byte order. Catches an HTML/XML error page served in
 * place of a raster before it ever reaches the worker.
 */
export function isTiff(bytes: Uint8Array): boolean {
	if (bytes.length < 4) return false;
	const [a, b, c, d] = bytes;
	if (a === 0x49 && b === 0x49) return d === 0x00 && (c === 0x2a || c === 0x2b);
	if (a === 0x4d && b === 0x4d) return c === 0x00 && (d === 0x2a || d === 0x2b);
	return false;
}

/**
 * Reject with `message` if `promise` has not settled within `ms`. The timer is
 * cleared as soon as the promise settles either way.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(message)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
```

- [ ] **Step 4: Run, confirm green**

```bash
npx vitest run src/lib/rasterGuards.spec.ts 2>&1 | grep -E 'Tests '   # expect: 12 passed (12)
```

Note on the `_` in `new Promise<never>((_, reject) => …)`: `@typescript-eslint/no-unused-vars` defaults to `args: 'after-used'`, which allows an unused parameter that comes before a used one. It should therefore lint clean. If lint fails on it anyway, make the smallest fix and report exactly what you changed.

- [ ] **Step 5: Use both guards in `renderSearchResult`** (`src/lib/components/MapView.svelte`)

Add the import beside the other `$lib` imports:

```ts
import { isTiff, withTimeout, RASTER_PARSE_TIMEOUT_MS } from '$lib/rasterGuards';
```

In `renderSearchResult`, between the byte-decoding loop and the georaster import, insert the magic-number check. Then wrap the parse in the timeout. The two existing lines

```ts
const parseGeoraster = await import('georaster').then((m) => m.default);
const georaster = await parseGeoraster(bytes.buffer);
```

become:

```ts
// A non-TIFF (e.g. an HTML error page served in place of the raster) would
// hang georaster's Web Worker forever — reject it up front. See rasterGuards.ts.
if (!isTiff(bytes)) {
	throw new Error('Search result is not a GeoTIFF');
}

const parseGeoraster = await import('georaster').then((m) => m.default);
// Backstop for any other parse that never settles (same worker issue).
const georaster = await withTimeout(
	parseGeoraster(bytes.buffer),
	RASTER_PARSE_TIMEOUT_MS,
	'Timed out parsing the crop raster'
);
```

Change nothing else in MapView.

- [ ] **Step 6: Static checks**

```bash
npx prettier --write src/lib/rasterGuards.ts src/lib/rasterGuards.spec.ts src/lib/components/MapView.svelte >/dev/null
npm test 2>&1 | grep -E 'Tests '      # expect: 87 passed (87)   (75 + 12)
npm run check 2>&1 | tail -1          # expect: 0 ERRORS 0 WARNINGS
npm run lint >/dev/null 2>&1; echo $? # expect: 0
npm run build 2>&1 | tail -1          # expect: ✔ done
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/rasterGuards.ts src/lib/rasterGuards.spec.ts src/lib/components/MapView.svelte
git commit -m "fix: reject non-TIFF payloads and time out hung raster parses instead of hanging"
```

The orchestrator re-runs live check 4d afterwards. Expected: the "Failed to render crop overlay" toast, Search re-enabled, no layer.

---

## Task 4: Live verification (browser, Playwright MCP)

**Files:** none. This task only produces evidence, which is recorded in the PR body and the audit markers.

Start the dev server in the background on a fixed port:

```bash
npm run dev -- --port 5199 --strictPort
```

Seed the test location and open the app (Playwright `browser_navigate` to `http://localhost:5199/`, then `browser_evaluate`):

```js
() => {
	localStorage.clear();
	localStorage.setItem('ff-last-location', JSON.stringify({ lat: 40.55395, lon: -100.076157 }));
	localStorage.setItem('ff-last-radius', '10');
	location.reload();
	return 'ok';
};
```

Install a loading-message recorder after the reload (it records every distinct overlay message and the Search button's disabled state over time):

```js
() => {
	window.__msgs = [];
	const read = () => {
		const el = document.querySelector('main')?.innerText ?? '';
		// The button reads "Searching..." while loading, so match both labels.
		const btn = [...document.querySelectorAll('button')].find((b) =>
			/^Search(ing\.\.\.)?$/.test(b.textContent.trim())
		);
		// LoadingOverlay appends 1–3 animated dots every 500 ms; strip trailing dots
		// so each message records once instead of once per animation tick.
		const raw = (el.match(
			/(Starting|Fetching|Extracting|Preparing|Downloading|Rendering|Stubbed)[^\n]*/
		) || [''])[0];
		const msg = raw.replace(/\.+$/, '');
		const last = window.__msgs.at(-1);
		const entry = `${msg || '(none)'} | disabled=${btn?.disabled}`;
		if (last !== entry) window.__msgs.push(entry);
	};
	new MutationObserver(read).observe(document.body, {
		subtree: true,
		childList: true,
		characterData: true,
		attributes: true
	});
	return 'recording';
};
```

The state probe used after each step:

```js
() => ({
	layers: document.querySelectorAll('img.leaflet-image-layer').length,
	searchDisabled: [...document.querySelectorAll('button')].find((b) =>
		/^Search(ing\.\.\.)?$/.test(b.textContent.trim())
	)?.disabled,
	summary:
		[...document.querySelectorAll('button')]
			.find((b) => b.textContent.includes('Area Summary'))
			?.textContent.trim() ?? null,
	toast: document.body.innerText.includes('Failed to render crop overlay'),
	msgs: window.__msgs
});
```

> **Year note:** this branch is cut from `main`, where `CDL_MAX_YEAR` is still 2024 (the bump to 2025 lives in PR #4). So the dropdown has no 2025 option here — use 2024 and 2023.

- [ ] **4a. Real search, 2024 (needs CDL)** — select year 2024, click Search, wait for "Area Summary" (up to ~60 s). Probe. Expected:
  - `layers: 1`, `searchDisabled: false`, `summary` contains `2024`, `toast: false`;
  - `msgs` ends with `Rendering crop overlay | disabled=true` followed by `(none) | disabled=false`.

- [ ] **4b. Second real search with a different year (needs CDL)** — reset `window.__msgs = []`, select 2023, click Search, wait. Probe. Expected:
  - `layers: 1` (the 2024 overlay was replaced, not stacked);
  - `summary` contains `2023`;
  - `searchDisabled: false`.

  Then drag the opacity slider, or set it via `browser_evaluate`: set the range input's `value`, then dispatch `new Event('input', { bubbles: true })`. It must bubble because Svelte 5 delegates `oninput` to the root. Then confirm the single `img.leaflet-image-layer` `style.opacity` changes. That proves `overlay` is still assigned for the opacity effect.

> **Lesson from the 2026-11-02 run (use this instead of the synthetic TIFF for 4c):** pasting ~1.7 KB of base64 into a `browser_evaluate` call got corrupted in transcription (`atob` threw `InvalidCharacterError`), so every run took the error path instead. The better technique is to **capture a real raster**. Wrap `window.fetch` so `/api/search` responses are `tee()`d, parse the `done` event, and store `window.__realTif`. Then stub two `done` events with that ~1 MB payload. A real raster takes ~700 ms to render, so the second result really does land mid-parse, which is the true F1 race. A 16×16 raster finishes inside the 40 ms gap and so cannot exercise it.

- [ ] **4c. Two results back to back — the F1 shape, through the real app (no CDL needed).** Stub `/api/search` to stream two `done` events 40 ms apart, using the synthetic GeoTIFF. Generate its base64 first:

```bash
cat > .tinytif.tmp.mjs <<'EOF'
import { writeArrayBuffer } from 'geotiff';
const values = new Uint8Array(16 * 16).map((_, i) => (i % 3 === 0 ? 1 : i % 3 === 1 ? 24 : 0));
const buf = await writeArrayBuffer(values, { width: 16, height: 16 });
process.stdout.write(Buffer.from(buf).toString('base64'));
EOF
node .tinytif.tmp.mjs; rm .tinytif.tmp.mjs
```

(Verified 2026-11-02: produces ~1.7 KB of base64 that `georaster` parses as a 16×16 raster with values 1/24/0. It has no palette, so pixels render transparent-or-default. That is fine because this step checks layer count and loading state, not color.)

Paste the base64 into the stub as `TIF` (`browser_evaluate`):

```js
() => {
	const TIF = 'PASTE_BASE64_HERE';
	const realFetch = window.__realFetch ?? window.fetch;
	window.__realFetch = realFetch;
	window.fetch = async (input, init) => {
		if (String(input).includes('/api/search')) {
			const enc = new TextEncoder();
			const body = new ReadableStream({
				async start(c) {
					c.enqueue(enc.encode('data: {"type":"progress","message":"Stubbed..."}\n\n'));
					c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'done', tifBase64: TIF })}\n\n`));
					await new Promise((r) => setTimeout(r, 40));
					c.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'done', tifBase64: TIF })}\n\n`));
					c.close();
				}
			});
			return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
		}
		return realFetch(input, init);
	};
	window.__msgs = [];
	return 'stubbed';
};
```

Click Search, wait ~2 s, probe. Expected:

- `layers: 1` (not 2);
- `searchDisabled: false`;
- loading message cleared;
- `toast: false`.

Repeat the click twice more. Expected: still `layers: 1` each time.

A 16×16 parse may finish inside the 40 ms gap. In that case the first run is cancelled after it attached (its layer removed), not mid-render. The final state is correct either way. Record which one happened: if `msgs` shows the message clearing between the two results, the first run had already attached.

- [ ] **4d. Render failure path — F4's error branch (no CDL needed).** Re-stub with one `done` whose payload is not a TIFF:

```js
() => {
	const realFetch = window.__realFetch;
	window.fetch = async (input, init) => {
		if (String(input).includes('/api/search')) {
			const enc = new TextEncoder();
			const body = new ReadableStream({
				start(c) {
					c.enqueue(
						enc.encode(
							`data: ${JSON.stringify({ type: 'done', tifBase64: btoa('not a tif') })}\n\n`
						)
					);
					c.close();
				}
			});
			return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
		}
		return realFetch(input, init);
	};
	window.__msgs = [];
	return 'stubbed-bad';
};
```

Click Search, wait ~2 s, probe. Expected:

- `toast: true`, `searchDisabled: false`;
- loading message cleared;
- `layers: 0`, because the previous overlay was torn down when the new result arrived;
- `summary: null`, because stats were cleared.

- [ ] **4e. Console** — `browser_console_messages` at level `error`. Expected: the only errors are `GeoTIFF rendering error:` entries from 4d. Anything else is a failure to investigate.

- [ ] **4f. Clean up** — restore `window.fetch = window.__realFetch`, close the browser, and stop the dev server.

Record the probe outputs for 4a–4d. They go in the PR body. If CDL was down for 4a/4b, record that those were **not run**.

---

## Task 5: Docs + wrap up

**Files:**

- Modify: `planning/audit-2026-08-26.md` (F1, F2, F4 headings; the "Tranche 2" table)
- Modify: `memory/CONTEXT.md`, `memory/decisions.md`, `planning/features.md`

First, apply the PR #4 rebase note at the top of this plan.

- [ ] **Step 1: Mark the audit items.** Prefix the three headings, matching tranche 1's format:
  - `### [FIXED 2026-11-02 · branch fix/audit-tranche-2a · <sha> — unit-tested + live-verified] F1. ...`
  - the same for F2 and F4, using the commit SHA from Task 1 or Task 3.

  For each heading, write "live-verified" only for the checks that actually ran in Task 4.

  In the "Tranche 2" table, mark row **2a** done.

- [ ] **Step 2: `memory/decisions.md` — append** (append-only; newest at the bottom; use the file's `### [date] title / Decision / Reason / Alternatives considered` format):
  - **Title:** `[2026-11-02] Overlay renders are cancellable runs owned by the $effect teardown; the page alone writes loadingMessage`.
  - **Decision:** `startOverlayRun` + teardown-cancel (F1); callbacks + page-owned `loadingMessage` (F4); `$state.raw` for `searchResult`.
  - **Reason:** the identity checks were scattered and left a race window; teardown makes Svelte the scheduler; a single writer removes the `handedOffToMap` split-brain.
  - **Alternatives considered:**
    - a repeated identity guard just before `addTo` (the audit's minimal fix — closes F1 but leaves F4 and the scattered checks);
    - a render-token counter on the page (works, but duplicates what effect teardown already gives for free);
    - a full search state machine (more than the current one-overlay app needs; revisit for year comparison).

- [ ] **Step 3: `memory/CONTEXT.md`** — update the "Key Technical Facts" bullets:
  - **`handedOffToMap`:** it still exists, but MapView now reports through `onRenderComplete`/`onRenderError` and the page clears the message.
  - **`overlay`:** it is set by the run's `onComplete` and cleared by the effect teardown.
  - **`searchResult`:** it is `$state.raw` and now carries `year`.
  - **"Active Work":** 2a is done, and next is the map-layers spec sub-project 1 (pending wpknox's read of the spec).

- [ ] **Step 4: `planning/features.md`** — add an "Implemented (audit tranche 2a)" section, three bullets mirroring F1/F2/F4. In "Planned", remove the "(blocked: do audit plan 2a, overlay hardening, first)" note from **Year comparison**.

- [ ] **Step 5: Format, final checks, commit**

```bash
npx prettier --write planning memory >/dev/null
npm test 2>&1 | grep -E 'Tests '      # expect: 74 passed (74)
npm run check 2>&1 | tail -1          # expect: 0 ERRORS 0 WARNINGS
npm run lint >/dev/null 2>&1; echo $? # expect: 0
npm run build 2>&1 | tail -1          # expect: ✔ done
git add planning memory
git commit -m "docs: mark audit F1/F2/F4 fixed and sync living docs for tranche 2a"
```

- [ ] **Step 6: Hand back.** Use `superpowers:finishing-a-development-branch`. wpknox chooses the outcome. Do **not** push or open a PR without that choice. If the choice is a PR, the body lists the three fixes, the test counts, and the Task 4 probe outputs verbatim, including anything not run.

---

## Deferred (next tranches)

- **2b — Honest errors:** B6 + D5, F3 + C4. F3's `typeof event.tifBase64 === 'string'` check belongs next to the `JSON.parse` in `handleSearch`. 4d above shows what a malformed payload looks like today: it surfaces as "Failed to render crop overlay", which is accurate enough but not specific.
- **2c — Cleanup batch:** C2, C3, C5, C6, B7, D1.
- **2d — e2e smoke test (C7):** unblocked now that CDL is healthy. Task 4's probes and stubs are a ready starting point for that script.
