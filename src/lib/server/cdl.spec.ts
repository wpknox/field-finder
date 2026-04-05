import { describe, it, expect, vi } from 'vitest';
import { parseReturnUrl, buildCdlFileUrl, buildExtractUrl, fetchCdlData } from './cdl';

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
