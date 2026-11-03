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
