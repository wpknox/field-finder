---
id: plan-audit-tranche-1
type: planning
description: Implementation plan for audit tranche 1 — prettier sweep, pan bug, search-result snapshot, year constant, CDL fetch timeouts
related:
  - planning/audit-2026-08-26.md
  - memory/CONTEXT.md
  - memory/decisions.md
  - planning/features.md
---

# Audit Tranche 1 — Correctness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five highest-value findings from `planning/audit-2026-08-26.md` (C1, B1, B2+B3, B4, B5) on a single branch, ending in a PR, so that the year-comparison feature can be built on a correct overlay foundation.

**Architecture:** Five independent changes, sequenced so the riskiest refactor (the search-result snapshot) lands on an already-formatted tree. The core structural change replaces the bare `tifBase64: string` prop threaded from `+page.svelte` into `MapView.svelte` with a `searchResult: SearchResult | null` object snapshotted at request time. A fresh object identity per search fixes both wrong-placement (B2) and the same-value-write soft-lock (B3) at once. The other four changes are localized: an `untrack()` on one line, a repo-wide `prettier --write`, a shared `CDL_MIN_YEAR`/`CDL_MAX_YEAR` constant module, and `AbortSignal.timeout()` on the three server-side CDL fetches.

**Tech Stack:** SvelteKit 2 / Svelte 5 runes, TypeScript, Vitest, Leaflet, georaster, Prettier + ESLint.

**Baseline (verify before starting):** `main` at `c889fff` — `npm test` 51/51 pass, `npm run check` 0 errors, `npx eslint .` clean, `npx prettier --check .` fails on 14 files.

---

## Scope

| Audit ID | What                                                                 | Task   |
| -------- | -------------------------------------------------------------------- | ------ |
| C1       | Prettier drift breaks `npm run lint`                                 | Task 1 |
| B1       | Map pans on every click/drag after first search                      | Task 2 |
| B2 + B3  | Overlay placed at render-time center; identical re-search soft-locks | Task 3 |
| B4       | Year range hardcoded to 2024 in three places                         | Task 4 |
| B5       | No timeout on CDL fetches                                            | Task 5 |

**Explicitly out of scope** (deferred to a later tranche): B6, B7, C2–C7, D1–D5, and the whole E feature backlog.

## Testing Reality Check

The repo has **no component-test infrastructure** — all 51 tests are pure-function unit tests. Tasks 2 and 3 change Svelte 5 `$effect` reactivity, which cannot be unit-tested with the current setup, so those tasks are verified **manually in a browser** with the steps written out below. Do not skip the manual verification and do not claim those tasks are done without running it. Tasks 4 and 5 touch pure functions and get real failing-test-first coverage.

Test location for the manual steps (from `CLAUDE.md`): **lat `40.553950`, lon `-100.076157`**.

Known external risk: the USDA CDL API is intermittently down (documented blocker in `planning/features.md`). A probe on 2026-08-26 returned empty for both 2024 and 2025. If the API is down when you reach a manual-verification step, **stop and report** rather than marking the step passed.

## File Structure

| File                                     | Change     | Responsibility                                                             |
| ---------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| repo-wide                                | Modify     | Prettier formatting (Task 1)                                               |
| `src/lib/components/MapView.svelte`      | Modify     | Pan effect untrack; consume `searchResult` instead of `tifBase64`          |
| `src/lib/searchResult.ts`                | **Create** | `SearchResult` type — the per-search snapshot passed to MapView            |
| `src/routes/+page.svelte`                | Modify     | Snapshot lat/lon/radius at request time; wrap SSE result in a fresh object |
| `src/lib/constants.ts`                   | **Create** | `CDL_MIN_YEAR` / `CDL_MAX_YEAR` single source of truth                     |
| `src/lib/components/YearSelector.svelte` | Modify     | Build dropdown from the constants                                          |
| `src/routes/api/search/+server.ts`       | Modify     | Validate year against constants; add tif-download timeout                  |
| `src/lib/server/cdl.ts`                  | Modify     | `AbortSignal.timeout()` on both CDL calls; timeout-specific error          |
| `src/lib/server/cdl.spec.ts`             | Modify     | Tests for the timeout behavior                                             |
| `CLAUDE.md`, `planning/features.md`      | Modify     | Update the stated year range                                               |

---

## Task 0: Branch setup

**Files:** none

- [ ] **Step 1: Confirm the baseline before changing anything**

```bash
git status --short
git log --oneline -1
npm test
npm run check
npx eslint .
```

Expected: clean working tree apart from the untracked/modified docs already present, `HEAD` at `c889fff` or later on `main`, tests 51/51 pass, check 0 errors, eslint silent.

- [ ] **Step 2: Create the branch**

```bash
git checkout -b fix/audit-tranche-1
```

---

## Task 1: C1 — Prettier format sweep

Standalone mechanical commit so it never muddies a behavioral diff. Do this **first** — every later task touches files in the unformatted list.

**Files:**

- Modify: repo-wide (14 files, incl. `src/lib/server/cdl.ts`, `src/routes/+page.svelte`, `src/routes/api/search/+server.ts`, `src/lib/components/{ErrorToast,LoadingOverlay,Sidebar}.svelte`, `src/lib/cropStats.spec.ts`, `src/lib/server/cdl.spec.ts`, `CLAUDE.md`, `planning/*.md`, `docs/superpowers/plans/*.md`)

- [ ] **Step 1: Record what is currently unformatted**

```bash
npx prettier --check . 2>&1 | tee /tmp/prettier-before.txt
```

Expected: `Code style issues found in 14 files.`

- [ ] **Step 2: Format**

```bash
npm run format
```

- [ ] **Step 3: Eyeball the diff for anything non-whitespace**

```bash
git diff --stat
git diff -- src/
```

Expected: only whitespace, quote-style, and line-wrap changes. **If any logic changed, stop and investigate** — Prettier should never alter behavior.

- [ ] **Step 4: Verify the whole toolchain is green**

```bash
npm run lint
npm test
npm run check
```

Expected: `npm run lint` now passes (this is the point of the task), tests 51/51, check 0 errors.

- [ ] **Step 5: Commit**

Stage only tracked files that Prettier actually rewrote — `git add -A` would sweep
the already-modified `memory/CONTEXT.md` and the untracked audit/plan docs into what
is supposed to be a formatting-only commit.

```bash
git add -u
git status --short   # confirm nothing unexpected is staged
git commit -m "style: run prettier across the repo

Fixes audit C1 — npm run lint was failing on 14 unformatted files.
Formatting only, no behavior change."
```

---

## Task 2: B1 — Map must not pan on click or marker drag

**Problem:** `src/lib/components/MapView.svelte` — the pan `$effect` guards on `panVersion === 0`, but line `const [lat, lon] = center;` is a _tracked_ read. Once the first address search sets `panVersion` to 1, the guard stops blocking and every later `center` change (map click, marker drag-end) re-runs the effect and calls `map.panTo`. This contradicts the logged decision ([2026-03-19] `panVersion` entry in `memory/decisions.md`): pan happens **only** on address search / lat-lon input.

**Files:**

- Modify: `src/lib/components/MapView.svelte` (the pan `$effect`, ~line 140 pre-format; find it by the comment "Pan map when the parent signals a new location was selected")

- [ ] **Step 1: Reproduce the bug in the browser**

```bash
npm run dev
```

Open the app, search an address (e.g. `Eustis, NE`). Then click somewhere else on the map, well away from the current center.
Expected (buggy): the map re-centers on the clicked point.
**Write down what you observed.** If the map does _not_ re-center, the bug is not reproducing — stop and report before changing code.

- [ ] **Step 2: Apply the fix**

`untrack` is already imported at the top of the file. Change the effect body so `center` is read untracked, leaving `panVersion` as the only tracked dependency:

```svelte
	// Pan map when the parent signals a new location was selected (address search / lat-lon input).
	// panVersion is only incremented by handleLocationSelect, not by map clicks or marker drag.
	// center is read untracked so that panVersion is the effect's ONLY reactive dependency —
	// otherwise a click or drag (which changes center) would re-pan the map. See audit B1.
	$effect(() => {
		if (!mapReady || !map || panVersion === 0) return;
		const [lat, lon] = untrack(() => center);
		map.panTo([lat, lon]);
	});
```

- [ ] **Step 3: Verify manually — pan still works when it should**

With the dev server running: search an address.
Expected: the map pans to it. Then type raw coordinates `40.553950, -100.076157` and press Enter.
Expected: the map pans there.

- [ ] **Step 4: Verify manually — pan no longer happens when it shouldn't**

Click somewhere else on the map.
Expected: the marker and bbox rectangle move to the clicked point, but **the map view does not re-center**.
Then drag the marker several miles and release.
Expected: **no pan on release.**

- [ ] **Step 5: Verify the toolchain**

```bash
npm test && npm run check && npm run lint
```

Expected: 51/51, 0 errors, lint passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/MapView.svelte
git commit -m "fix: stop the map panning on click and marker drag

The pan effect read center tracked, so once panVersion left 0 the guard
never blocked again and every center change re-panned. Read center via
untrack so panVersion is the only dependency. Fixes audit B1."
```

---

## Task 3: B2 + B3 — Snapshot the search parameters in a result object

**Problem (B2):** `MapView.svelte`'s overlay `$effect` captures `center` and `radius` with `untrack()` _inside the effect_, which runs when `tifBase64` arrives — i.e. **after** the multi-second CDL fetch. If the user drags the marker or moves the radius slider while waiting, the raster (fetched for the old bbox) is drawn at the new center/radius. The comment claims "search-time snapshot"; it is a render-time snapshot.

**Problem (B3):** `src/routes/+page.svelte` assigns `tifBase64 = event.tifBase64`. If a repeated identical search returns byte-identical data, Svelte 5 skips notification on the same-value primitive write, the overlay effect never re-runs, and nothing clears `loadingMessage` (the `finally` skips it because `handedOffToMap` is true) — the loading overlay persists and the Search button stays disabled.

**One fix for both:** snapshot `{ tifBase64, lat, lon, radius }` into a **new object** in `handleSearch` at the moment the response arrives, using the lat/lon/radius captured _before_ the request was sent. Fresh object identity always retriggers the effect.

**Files:**

- Create: `src/lib/searchResult.ts`
- Modify: `src/routes/+page.svelte`
- Modify: `src/lib/components/MapView.svelte`

- [ ] **Step 1: Reproduce B2 in the browser**

```bash
npm run dev
```

Set the location to `40.553950, -100.076157`, radius 10 mi, hit Search. While "Fetching crop data..." is showing, drag the marker several miles away.
Expected (buggy): when the overlay appears it sits over the marker's **new** position, not the bbox that was searched.
Record what you observed. (If CDL is down, note it and move on — the fix is still correct, but you must come back and verify before the PR.)

- [ ] **Step 2: Create the shared result type**

Create `src/lib/searchResult.ts`:

```ts
/**
 * A completed CDL search, snapshotted at request time.
 *
 * lat/lon/radius are captured BEFORE the request is sent, so the overlay is
 * always placed over the bbox that was actually searched — even if the user
 * moves the marker or the radius slider while the fetch is in flight.
 *
 * Every completed search produces a NEW object. That fresh identity is what
 * retriggers MapView's overlay $effect, even when two consecutive searches
 * return byte-identical raster data. See audit B2/B3.
 */
export interface SearchResult {
	/** Base64-encoded GeoTIFF returned by the CDL API. */
	tifBase64: string;
	/** Search-time center latitude. */
	lat: number;
	/** Search-time center longitude. */
	lon: number;
	/** Search-time radius in miles. */
	radius: number;
}
```

- [ ] **Step 3: Snapshot the request parameters in `+page.svelte`**

Replace the `tifBase64` state declaration:

```svelte
	let searchResult = $state<SearchResult | null>(null);
```

Add the import alongside the other `$lib` imports:

```svelte
import type {SearchResult} from '$lib/searchResult';
```

In `handleSearch`, capture the parameters **before** the `fetch` and use them in the request body:

```svelte
		// Snapshot the search parameters up front — the user is free to move the
		// marker or the radius slider while the multi-second fetch is in flight,
		// and the overlay must be placed where the search actually happened.
		const searchLat = mapCenter[0];
		const searchLon = mapCenter[1];
		const searchRadius = radius;

		try {
			const selectedCropIds = Object.entries(cropFilters)
				.filter(([, checked]) => checked)
				.map(([key]) => CROPS[key as CropKey].id);

			const resp = await fetch('/api/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					lat: searchLat,
					lon: searchLon,
					radius: searchRadius,
					year,
					crops: selectedCropIds
				})
			});
```

And in the SSE `done` branch, build a fresh object:

```svelte
					} else if (event.type === 'done') {
						searchResult = {
							tifBase64: event.tifBase64,
							lat: searchLat,
							lon: searchLon,
							radius: searchRadius
						};
						handedOffToMap = true;
					} else if (event.type === 'error') {
```

Finally, update the `<MapView>` invocation — replace `{tifBase64}` with `{searchResult}`.

- [ ] **Step 4: Consume the snapshot in `MapView.svelte`**

Add the import:

```svelte
import type {SearchResult} from '$lib/searchResult';
```

In `$props()`, replace `tifBase64 = ''` with `searchResult = null` in both the destructuring and the type literal:

```svelte
searchResult = null,
```

```svelte
searchResult?: SearchResult | null;
```

Rewrite the head of the overlay `$effect` so it reads the snapshot instead of the live `center`/`radius`, and guards staleness on object identity:

```svelte
	$effect(() => {
		if (!mapReady || !map || !searchResult) return;

		const oldOverlay = untrack(() => overlay);
		if (oldOverlay) {
			map!.removeLayer(oldOverlay);
			overlay = undefined;
			cropStats = [];
		}

		// The snapshot carries the center/radius the search was issued with, so the
		// overlay lands on the searched bbox regardless of what the user has moved
		// since. A new object per search also guarantees this effect re-runs even
		// when two searches return identical raster bytes. See audit B2/B3.
		const currentResult = searchResult;
		const { tifBase64: currentTif, lat, lon, radius: r } = currentResult;
```

Then replace **both** stale-check comparisons further down in the effect. There are two — one after `parseGeoraster`, one in the `catch`:

```svelte
if (searchResult !== currentResult) return;
```

```svelte
				if (searchResult === currentResult) {
					loadingMessage = '';
					errorMessage = 'Failed to render crop overlay';
				}
```

Delete the now-dead `const [lat, lon] = untrack(() => center);` and `const r = untrack(() => radius);` lines and the stale "Capture search-time center/radius" comment they carried.

- [ ] **Step 5: Confirm nothing still references the old prop**

```bash
grep -rn "tifBase64" src/
```

Expected hits — all four are legitimate:

- `src/lib/searchResult.ts` — the interface field
- `src/lib/components/MapView.svelte` — the `tifBase64: currentTif` destructure inside the overlay effect
- `src/routes/+page.svelte` — `tifBase64: event.tifBase64` inside the new object literal (from Step 3)
- `src/routes/api/search/+server.ts` — the server's SSE payload field name, unchanged

What must **not** appear: a `tifBase64` prop on `<MapView>`, or `let tifBase64 = $state` in `+page.svelte`.

- [ ] **Step 6: Verify the toolchain**

```bash
npm test && npm run check && npm run lint
```

Expected: 51/51, 0 errors (svelte-check is what catches a missed prop rename), lint passes.

- [ ] **Step 7: Verify B2 manually**

```bash
npm run dev
```

Location `40.553950, -100.076157`, radius 10 mi, Search. While "Fetching crop data..." shows, drag the marker several miles away.
Expected: the overlay appears over the **original** searched area — not under the moved marker. The bbox rectangle will have followed the marker; the overlay must not.

Repeat with the radius slider: start a 10 mi search, drag the slider to 25 mi mid-fetch.
Expected: the overlay is drawn at the 10 mi extent.

- [ ] **Step 8: Verify B3 manually**

Run the exact same search twice in a row — same location, radius, year, crop selection.
Expected: the second run completes, the loading overlay clears, and the Search button re-enables. (Before the fix this could hang on "Downloading crop data...".)

- [ ] **Step 9: Commit**

```bash
git add src/lib/searchResult.ts src/routes/+page.svelte src/lib/components/MapView.svelte
git commit -m "fix: pin the crop overlay to the searched bbox

MapView captured center/radius when the raster arrived, not when the search
was issued, so moving the marker mid-fetch placed the overlay wrong. Snapshot
lat/lon/radius in handleSearch and pass a SearchResult object; the fresh
object identity also makes an identical repeat search retrigger the overlay
effect instead of soft-locking the loading state.

Fixes audit B2 and B3."
```

---

## Task 4: B4 — Single source of truth for the CDL year range

**Problem:** the 1997–2024 range is hardcoded in three places (`src/routes/api/search/+server.ts` validation, `src/lib/components/YearSelector.svelte`, `year = $state(2024)` in `src/routes/+page.svelte`) plus two docs. CDL publishes the prior year's layer each winter, so this goes stale annually.

**Files:**

- Create: `src/lib/constants.ts`
- Create: `src/lib/constants.spec.ts`
- Modify: `src/lib/components/YearSelector.svelte`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/api/search/+server.ts`
- Modify: `CLAUDE.md`, `planning/features.md`

- [ ] **Step 1: Determine whether the 2025 layer exists**

```bash
curl -s -m 60 "https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLFile?year=2025&bbox=-300000,1800000,-280000,1820000"
curl -s -m 60 "https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLFile?year=2024&bbox=-300000,1800000,-280000,1820000"
```

Decide from the output:

- **2025 returns `<returnURL>` and 2024 does too** → set `CDL_MAX_YEAR = 2025`.
- **2024 returns `<returnURL>`, 2025 returns an error/empty** → the 2025 layer is not published; keep `CDL_MAX_YEAR = 2024`.
- **Both empty or the request times out** → the CDL service is down (a probe on 2026-08-26 hit exactly this). Keep `CDL_MAX_YEAR = 2024`, do the refactor anyway (its whole point is making the bump one line), and note in the PR description that the max year still needs confirming. You can also cross-check by hand at <https://nassgeodata.gmu.edu/CropScape/>.

Record which branch you took and the evidence.

- [ ] **Step 2: Write the failing test**

Create `src/lib/constants.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CDL_MIN_YEAR, CDL_MAX_YEAR, CDL_YEARS } from './constants';

describe('CDL year constants', () => {
	it('spans a sane range', () => {
		expect(CDL_MIN_YEAR).toBe(1997);
		expect(CDL_MAX_YEAR).toBeGreaterThanOrEqual(2024);
	});

	it('CDL_YEARS lists every year newest-first', () => {
		expect(CDL_YEARS[0]).toBe(CDL_MAX_YEAR);
		expect(CDL_YEARS[CDL_YEARS.length - 1]).toBe(CDL_MIN_YEAR);
		expect(CDL_YEARS).toHaveLength(CDL_MAX_YEAR - CDL_MIN_YEAR + 1);
	});
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx vitest run src/lib/constants.spec.ts
```

Expected: FAIL — cannot resolve `./constants`.

- [ ] **Step 4: Create the constants module**

Create `src/lib/constants.ts` (use the `CDL_MAX_YEAR` value decided in Step 1):

```ts
/**
 * Range of years the USDA CDL publishes a Cropland Data Layer for.
 *
 * NASS releases the previous year's layer each winter. When a new layer lands,
 * bump CDL_MAX_YEAR here — it is the single source of truth for the year
 * dropdown, the default selection, and server-side request validation.
 */
export const CDL_MIN_YEAR = 1997;
export const CDL_MAX_YEAR = 2024;

/** Every selectable CDL year, newest first (dropdown order). */
export const CDL_YEARS = Array.from(
	{ length: CDL_MAX_YEAR - CDL_MIN_YEAR + 1 },
	(_, i) => CDL_MAX_YEAR - i
);
```

- [ ] **Step 5: Run the test and watch it pass**

```bash
npx vitest run src/lib/constants.spec.ts
```

Expected: PASS (3 assertions across 2 tests).

- [ ] **Step 6: Point `YearSelector.svelte` at the constants**

```svelte
<!-- src/lib/components/YearSelector.svelte -->
<script lang="ts">
	import { CDL_MAX_YEAR, CDL_YEARS } from '$lib/constants';

	let { year = $bindable(CDL_MAX_YEAR) }: { year?: number } = $props();
</script>
```

and iterate `CDL_YEARS` in the `{#each}` instead of the local `years`.

- [ ] **Step 7: Point `+page.svelte` at the constants**

`+page.svelte` has no `$lib/constants` import yet (Task 3 only added `$lib/searchResult`), so add a new import line:

```svelte
import {CDL_MAX_YEAR} from '$lib/constants';
```

and change the default:

```svelte
let year = $state(CDL_MAX_YEAR);
```

- [ ] **Step 8: Point the server validation at the constants**

In `src/routes/api/search/+server.ts`:

```ts
import { CDL_MIN_YEAR, CDL_MAX_YEAR } from '$lib/constants';
```

```ts
if (typeof year !== 'number' || year < CDL_MIN_YEAR || year > CDL_MAX_YEAR) {
	error(400, `year must be between ${CDL_MIN_YEAR} and ${CDL_MAX_YEAR}`);
}
```

- [ ] **Step 9: Confirm no hardcoded range survives**

```bash
grep -rn "2024" src/ --include=*.svelte --include=*.ts | grep -v spec
```

Expected: no year-range literals left in `YearSelector.svelte`, `+page.svelte`, or `api/search/+server.ts`. (`src/lib/constants.ts` itself is the one legitimate hit; incidental `2024`s in test fixtures are fine.)

- [ ] **Step 10: Update the docs**

There are **three** stale mentions, verified by `grep -n "1997\|2000" CLAUDE.md planning/features.md`:

- `CLAUDE.md:41` — "Accepts a year (2000–2024)"
- `planning/features.md:24` — "Year dropdown (1997–2024, default latest)"
- `planning/features.md:90` — "Year range currently supported by CDL: 1997–2024 (validate on input)"

Update all three to match `CDL_MAX_YEAR`, and add a short note that the range now lives in `src/lib/constants.ts`. Re-run the grep afterward to confirm none are left.

- [ ] **Step 11: Verify the toolchain**

```bash
npm test && npm run check && npm run lint
```

Expected: 53/53 (51 + the 2 new), 0 errors, lint passes.

- [ ] **Step 12: Verify manually**

```bash
npm run dev
```

Expected: the dropdown's top entry is `CDL_MAX_YEAR` and it is preselected; the oldest entry is 1997. Run a search on the newest year and confirm an overlay renders.

Then confirm the server rejects an out-of-range year:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:5173/api/search \
  -H 'Content-Type: application/json' \
  -d '{"lat":40.553950,"lon":-100.076157,"radius":10,"year":2099,"crops":[]}'
```

Expected: `400`.

- [ ] **Step 13: Commit**

```bash
git add src/lib/constants.ts src/lib/constants.spec.ts src/lib/components/YearSelector.svelte src/routes/+page.svelte src/routes/api/search/+server.ts CLAUDE.md planning/features.md
git commit -m "refactor: move the CDL year range into a shared constant

The 1997-2024 range was hardcoded in the dropdown, the default state, and
the server validator. Next year's bump is now one line in
src/lib/constants.ts. Fixes audit B4."
```

---

## Task 5: B5 — Time out CDL fetches instead of hanging forever

**Problem:** `fetchCdlData` in `src/lib/server/cdl.ts` and the `.tif` download in `src/routes/api/search/+server.ts` call `fetch` with no `AbortSignal`. When NASS hangs (a documented, recurring blocker) the SSE stream stays open and the client spins indefinitely with no error.

**Design:** add an optional `timeoutMs` parameter to `fetchCdlData` (default 60s per call) so the tests can drive a short timeout without waiting a minute. Rethrow a `TimeoutError` as a recognizable `CdlTimeoutError` so the route can send a distinct, honest message.

**Files:**

- Modify: `src/lib/server/cdl.ts`
- Modify: `src/lib/server/cdl.spec.ts`
- Modify: `src/routes/api/search/+server.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/server/cdl.spec.ts`:

```ts
describe('fetchCdlData timeouts', () => {
	it('rejects with CdlTimeoutError when the CDL API never responds', async () => {
		// A fetch that only ever settles by rejecting when the caller aborts —
		// exactly how a hung upstream behaves with an AbortSignal attached.
		const hangingFetch = vi.fn(
			(_url: string, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () =>
						reject(new DOMException('The operation was aborted.', 'TimeoutError'))
					);
				})
		) as unknown as typeof fetch;

		await expect(
			fetchCdlData(
				{
					year: 2024,
					albers: { xMin: -300000, yMin: 1800000, xMax: -280000, yMax: 1820000 },
					crops: []
				},
				hangingFetch,
				undefined,
				50
			)
		).rejects.toBeInstanceOf(CdlTimeoutError);
	});

	it('passes an AbortSignal to every CDL request', async () => {
		const xml = '<returnURL>https://example.com/raster.tif</returnURL>';
		const okFetch = vi.fn(
			async () => new Response(xml, { status: 200 })
		) as unknown as typeof fetch;

		await fetchCdlData(
			{
				year: 2024,
				albers: { xMin: -300000, yMin: 1800000, xMax: -280000, yMax: 1820000 },
				crops: [4]
			},
			okFetch,
			undefined,
			5000
		);

		expect(vi.mocked(okFetch)).toHaveBeenCalledTimes(2);
		for (const [, init] of vi.mocked(okFetch).mock.calls) {
			expect((init as RequestInit | undefined)?.signal).toBeInstanceOf(AbortSignal);
		}
	});
});
```

Add `CdlTimeoutError` to the import at the top of the spec file.

- [ ] **Step 2: Run the tests and watch them fail**

```bash
npx vitest run src/lib/server/cdl.spec.ts
```

Expected: FAIL — `CdlTimeoutError` is not exported.

- [ ] **Step 3: Implement the timeout in `src/lib/server/cdl.ts`**

Add near the top:

```ts
/** Default per-request timeout for CDL calls. NASS hangs rather than erroring. */
export const CDL_TIMEOUT_MS = 60_000;

/** Thrown when a CDL request exceeds its timeout, so callers can report it distinctly. */
export class CdlTimeoutError extends Error {
	constructor(step: string) {
		super(`CDL request timed out during ${step}`);
		this.name = 'CdlTimeoutError';
	}
}

/** True for the DOMException fetch raises when an AbortSignal.timeout() fires. */
export function isTimeoutError(err: unknown): boolean {
	return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
}
```

Extend the signature and wrap each call:

```ts
export async function fetchCdlData(
	request: CdlRequest,
	fetchFn: typeof fetch = fetch,
	onProgress?: (step: CdlProgressStep) => void,
	timeoutMs: number = CDL_TIMEOUT_MS
): Promise<string> {
	const get = async (url: string, step: string): Promise<Response> => {
		try {
			return await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
		} catch (err) {
			if (isTimeoutError(err)) throw new CdlTimeoutError(step);
			throw err;
		}
	};

	// Step 1: Get raster file
	onProgress?.('fetching');
	const rasterResp = await get(buildCdlFileUrl(request.year, request.albers), 'GetCDLFile');
	...
```

Do the same for the `ExtractCDLByValues` call (`'ExtractCDLByValues'` as the step label). Keep the existing `!resp.ok` checks unchanged.

- [ ] **Step 4: Run the tests and watch them pass**

```bash
npx vitest run src/lib/server/cdl.spec.ts
```

Expected: PASS, including the pre-existing `fetchCdlData` tests (they call it with two or three args, so the defaulted fourth parameter must not break them).

- [ ] **Step 5: Time out the tif download and report timeouts honestly**

In `src/routes/api/search/+server.ts`, import the helpers:

```ts
import {
	fetchCdlData,
	CdlTimeoutError,
	CDL_TIMEOUT_MS,
	isTimeoutError,
	type CdlProgressStep
} from '$lib/server/cdl';
```

Give the download its own, longer budget (raster payloads are large) and catch its timeout:

```ts
send({ type: 'progress', message: 'Downloading crop data...' });
let tifResp: Response;
try {
	// The raster itself can be tens of MB, so it gets a longer budget
	// than the two metadata calls.
	tifResp = await fetch(rasterUrl, { signal: AbortSignal.timeout(CDL_TIMEOUT_MS * 2) });
} catch (err) {
	if (isTimeoutError(err)) {
		send({
			type: 'error',
			message: 'USDA CDL service is not responding — try again later'
		});
		return;
	}
	throw err;
}
```

And in the outer `catch`, distinguish the timeout:

```ts
			} catch (err) {
				console.error('CDL API error:', err);
				send({
					type: 'error',
					message:
						err instanceof CdlTimeoutError
							? 'USDA CDL service is not responding — try again later'
							: 'Failed to fetch crop data from CDL API'
				});
			} finally {
```

- [ ] **Step 6: Verify the toolchain**

```bash
npm test && npm run check && npm run lint
```

Expected: 55/55 (53 + the 2 new), 0 errors, lint passes.

- [ ] **Step 7: Verify the happy path is unbroken**

```bash
npm run dev
```

Run a normal search. Expected: the overlay still renders as before — the timeouts must be invisible when CDL is healthy. (If CDL is down, you will instead see the new "USDA CDL service is not responding" toast after the timeout elapses, which is itself a valid confirmation of the fix — record which you saw.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/server/cdl.ts src/lib/server/cdl.spec.ts src/routes/api/search/+server.ts
git commit -m "fix: time out CDL fetches instead of spinning forever

All three server-side CDL requests now carry an AbortSignal.timeout, and a
timeout surfaces as 'USDA CDL service is not responding' rather than an
endless loading overlay. Fixes audit B5."
```

---

## Task 6: Wrap up the branch

**Files:** `planning/audit-2026-08-26.md`, living docs

- [ ] **Step 1: Full fresh verification**

```bash
npm test
npm run check
npm run lint
npm run build
```

Expected: 55/55 pass, 0 check errors, lint passes, build succeeds. (The audit did not run a build; this is the first one — if it fails, that is a new finding, not a regression from this branch. Investigate before opening the PR.)

- [ ] **Step 2: Mark the addressed items in the audit**

In `planning/audit-2026-08-26.md`, prefix the headings for C1, B1, B2, B3, B4, B5 with `[FIXED 2026-08-26 — branch fix/audit-tranche-1]` so a future session does not re-work them. Leave the remaining items untouched.

- [ ] **Step 3: Commit the audit update**

```bash
git add planning/audit-2026-08-26.md
git commit -m "docs: mark audit tranche 1 items as fixed"
```

- [ ] **Step 4: Open the PR**

REQUIRED SUB-SKILL: use `superpowers:finishing-a-development-branch`. The PR description should list each audit ID fixed, state which manual verifications were actually run in a browser (and which were blocked by CDL downtime, if any), and flag whether `CDL_MAX_YEAR` still needs confirming from Task 4 Step 1.

- [ ] **Step 5: Sync the living docs**

Run `/msync` to update `memory/CONTEXT.md`, `memory/decisions.md` (log the `SearchResult` snapshot pattern and the CDL timeout policy), and `planning/features.md`.

---

## Deferred (next tranche)

In the audit's suggested order, picking up where this plan stops: D1 (persist year), B6+D5 (honest geocode errors), C2 (drop `georaster-layer-for-leaflet`), the B7/C3/C4/C5/C6 nit batch, and C7 (opt-in Playwright e2e smoke test). Per the audit, the **year comparison** feature should be built only after Task 3 lands, on top of the `SearchResult` snapshot pattern.
