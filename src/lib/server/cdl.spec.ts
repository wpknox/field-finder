import { describe, it, expect, vi } from 'vitest';
import {
	parseReturnUrl,
	buildCdlFileUrl,
	buildExtractUrl,
	fetchCdlData,
	CdlTimeoutError,
	isTimeoutError
} from './cdl';

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
	it('calls GetCDLFile and ExtractCDLByValues, returns filtered raster URL', async () => {
		const mockFetch = vi
			.fn()
			.mockResolvedValueOnce({
				ok: true,
				text: async () => `<r><returnURL>https://nassgeodata.gmu.edu/raster.tif</returnURL></r>`
			})
			.mockResolvedValueOnce({
				ok: true,
				text: async () => `<r><returnURL>https://nassgeodata.gmu.edu/filtered.tif</returnURL></r>`
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
			text: async () => `<r><returnURL>https://nassgeodata.gmu.edu/raster.tif</returnURL></r>`
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
				text: async () => `<r><returnURL>https://nassgeodata.gmu.edu/raster.tif</returnURL></r>`
			})
			.mockResolvedValueOnce({
				ok: true,
				text: async () => `<r><returnURL>https://nassgeodata.gmu.edu/filtered.tif</returnURL></r>`
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

describe('isTimeoutError', () => {
	// Node's fetch reports transport failures as `TypeError: fetch failed` and puts
	// the real reason on `.cause`. Shape verified empirically against Node 24 by
	// forcing a real connect timeout: err.name 'TypeError', cause.name
	// 'ConnectTimeoutError', cause.code 'UND_ERR_CONNECT_TIMEOUT'.
	const wrappedCause = (name: string, code: string) =>
		Object.assign(new TypeError('fetch failed'), {
			cause: Object.assign(new Error('Connect Timeout Error'), { name, code })
		});

	it('matches the DOMException our own AbortSignal.timeout produces', () => {
		expect(isTimeoutError(new DOMException('The operation was aborted.', 'TimeoutError'))).toBe(
			true
		);
		expect(isTimeoutError(new DOMException('The operation was aborted.', 'AbortError'))).toBe(true);
	});

	it('matches an undici connect timeout wrapped in TypeError: fetch failed', () => {
		expect(isTimeoutError(wrappedCause('ConnectTimeoutError', 'UND_ERR_CONNECT_TIMEOUT'))).toBe(
			true
		);
	});

	it('matches undici headers and body timeouts', () => {
		expect(isTimeoutError(wrappedCause('HeadersTimeoutError', 'UND_ERR_HEADERS_TIMEOUT'))).toBe(
			true
		);
		expect(isTimeoutError(wrappedCause('BodyTimeoutError', 'UND_ERR_BODY_TIMEOUT'))).toBe(true);
	});

	it('does NOT match an unreachable host — that is a different failure', () => {
		expect(isTimeoutError(wrappedCause('Error', 'ECONNREFUSED'))).toBe(false);
		expect(isTimeoutError(wrappedCause('Error', 'ENOTFOUND'))).toBe(false);
	});

	it('does NOT match ordinary errors or non-errors', () => {
		expect(isTimeoutError(new Error('boom'))).toBe(false);
		expect(isTimeoutError('not an error')).toBe(false);
		expect(isTimeoutError(undefined)).toBe(false);
	});
});

describe('fetchCdlData transport timeouts', () => {
	it('converts an undici connect timeout into CdlTimeoutError', async () => {
		// Regression: undici's connect timeout (10s) fires well before our 60s
		// AbortSignal, so this — not the AbortSignal path — is what the user hits
		// when NASS is unreachable. It used to escape as a bare TypeError and get
		// reported with the generic "Failed to fetch crop data" message.
		const connectTimeout = Object.assign(new TypeError('fetch failed'), {
			cause: Object.assign(new Error('Connect Timeout Error'), {
				name: 'ConnectTimeoutError',
				code: 'UND_ERR_CONNECT_TIMEOUT'
			})
		});
		const failingFetch = vi.fn(async () => {
			throw connectTimeout;
		}) as unknown as typeof fetch;

		await expect(
			fetchCdlData(
				{
					year: 2024,
					albers: { xMin: -300000, yMin: 1800000, xMax: -280000, yMax: 1820000 },
					crops: []
				},
				failingFetch
			)
		).rejects.toBeInstanceOf(CdlTimeoutError);
	});

	it('lets a genuinely different failure through unchanged', async () => {
		const refused = Object.assign(new TypeError('fetch failed'), {
			cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
		});
		const failingFetch = vi.fn(async () => {
			throw refused;
		}) as unknown as typeof fetch;

		await expect(
			fetchCdlData(
				{
					year: 2024,
					albers: { xMin: -300000, yMin: 1800000, xMax: -280000, yMax: 1820000 },
					crops: []
				},
				failingFetch
			)
		).rejects.toBe(refused);
	});
});
