const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'FieldFinder/1.0';

export interface GeocodingResult {
	displayName: string;
	lat: number;
	lon: number;
}

export function buildNominatimUrl(query: string): string {
	const params = new URLSearchParams({
		q: query,
		format: 'json',
		limit: '5',
		countrycodes: 'us'
	});
	return `${NOMINATIM_BASE}?${params.toString()}`;
}

export function parseNominatimResults(
	raw: Array<{ display_name: string; lat: string; lon: string }>
): GeocodingResult[] {
	return raw.map((r) => ({
		displayName: r.display_name,
		lat: parseFloat(r.lat),
		lon: parseFloat(r.lon)
	}));
}

// Simple rate limiter: track last request time
let lastRequestTime = 0;

async function enforceRateLimit(): Promise<void> {
	const now = Date.now();
	const elapsed = now - lastRequestTime;
	if (elapsed < 1000) {
		await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
	}
	lastRequestTime = Date.now();
}

/**
 * Geocode a search query via Nominatim.
 * Enforces 1 req/sec rate limit and sends proper User-Agent.
 */
export async function geocode(
	query: string,
	fetchFn: typeof fetch = fetch
): Promise<GeocodingResult[]> {
	await enforceRateLimit();

	const url = buildNominatimUrl(query);

	try {
		const resp = await fetchFn(url, {
			headers: { 'User-Agent': USER_AGENT }
		});

		if (!resp.ok) {
			return [];
		}

		const raw = await resp.json();
		return parseNominatimResults(raw);
	} catch {
		return [];
	}
}
