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
