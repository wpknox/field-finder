import { describe, it, expect, vi } from 'vitest';
import { POST } from './+server';

/**
 * First automated coverage of the SSE search route (audit C7 noted it had none).
 *
 * These exercise the paths that only occur when the upstream CDL service
 * misbehaves — the tif download stalling or 404ing — which cannot be reached
 * from the browser while NASS is healthy, and could not be reached at all
 * while it was down.
 */

const BBOX_XML = '<returnURL>https://nassgeodata.gmu.edu/results/raster.tif</returnURL>';

/** Drain the SSE body and return the parsed events in order. */
async function readEvents(resp: Response): Promise<Array<Record<string, unknown>>> {
	const reader = resp.body!.getReader();
	const decoder = new TextDecoder();
	let buf = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buf += decoder.decode(value, { stream: true });
	}
	return buf
		.split('\n')
		.filter((l) => l.startsWith('data: '))
		.map((l) => JSON.parse(l.slice(6)));
}

function makeRequest() {
	return new Request('http://localhost/api/search', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ lat: 40.55395, lon: -100.076157, radius: 10, year: 2024, crops: [] })
	});
}

/** The shape Node's fetch produces for an undici transport timeout. */
function connectTimeout() {
	return Object.assign(new TypeError('fetch failed'), {
		cause: Object.assign(new Error('Connect Timeout Error'), {
			name: 'ConnectTimeoutError',
			code: 'UND_ERR_CONNECT_TIMEOUT'
		})
	});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const invoke = (fetchFn: unknown) => POST({ request: makeRequest(), fetch: fetchFn } as any);

describe('POST /api/search — upstream failure paths', () => {
	it('reports a stalled tif download as a service-not-responding error', async () => {
		// GetCDLFile succeeds, then the raster download times out at the transport
		// layer. Before isTimeoutError inspected err.cause this fell through to the
		// generic message.
		let call = 0;
		const fetchFn = vi.fn(async () => {
			if (++call === 1) return new Response(BBOX_XML, { status: 200 });
			throw connectTimeout();
		});

		const events = await readEvents(await invoke(fetchFn));
		expect(events.at(-1)).toEqual({
			type: 'error',
			message: 'USDA CDL service is not responding — try again later'
		});
		expect(events.some((e) => e.type === 'done')).toBe(false);
	});

	it('reports a non-OK tif download distinctly from a timeout', async () => {
		let call = 0;
		const fetchFn = vi.fn(async () => {
			if (++call === 1) return new Response(BBOX_XML, { status: 200 });
			return new Response('not found', { status: 404 });
		});

		const events = await readEvents(await invoke(fetchFn));
		expect(events.at(-1)).toEqual({
			type: 'error',
			message: 'Failed to download crop data from CDL server'
		});
	});

	it('streams progress then a base64 raster on the happy path', async () => {
		const raster = new Uint8Array([1, 2, 3, 4, 5]);
		let call = 0;
		const fetchFn = vi.fn(async () => {
			if (++call === 1) return new Response(BBOX_XML, { status: 200 });
			return new Response(raster, { status: 200 });
		});

		const events = await readEvents(await invoke(fetchFn));
		expect(events.map((e) => e.type)).toEqual(['progress', 'progress', 'done']);
		expect(events.at(-1)!.tifBase64).toBe(Buffer.from(raster).toString('base64'));
	});

	it('surfaces a GetCDLFile timeout as the same honest message', async () => {
		const fetchFn = vi.fn(async () => {
			throw connectTimeout();
		});

		const events = await readEvents(await invoke(fetchFn));
		expect(events.at(-1)).toEqual({
			type: 'error',
			message: 'USDA CDL service is not responding — try again later'
		});
	});
});
