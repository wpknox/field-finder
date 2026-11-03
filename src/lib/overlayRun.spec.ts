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
		expect(deps.detach).not.toHaveBeenCalled();
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
		expect(deps.detach).not.toHaveBeenCalled();
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

	it('reports a layer-creation failure and attaches nothing', async () => {
		const { deps, rendered, created } = makeDeps();
		const failure = new Error('chunk load failed');

		const run = startOverlayRun(RESULT, deps);
		rendered.resolve('png-data');
		created.reject(failure);
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
