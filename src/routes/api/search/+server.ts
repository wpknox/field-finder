import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { computeSearchBbox } from '$lib/server/coordinates';
import { fetchCdlData } from '$lib/server/cdl';

export const POST: RequestHandler = async ({ request, fetch }) => {
	// Critical #1: Handle JSON parse errors
	let body;
	try {
		body = await request.json();
	} catch {
		error(400, 'Request body must be valid JSON');
	}

	// Validate required fields
	const { lat, lon, radius, year, crops } = body;
	if (typeof lat !== 'number' || typeof lon !== 'number') {
		error(400, 'lat and lon are required numbers');
	}
	// Critical #2: Validate lat/lon boundaries
	if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
		error(400, 'lat must be between -90 and 90, lon must be between -180 and 180');
	}
	if (typeof radius !== 'number' || radius < 1 || radius > 50) {
		error(400, 'radius must be between 1 and 50');
	}
	if (typeof year !== 'number' || year < 1997 || year > 2024) {
		error(400, 'year must be between 1997 and 2024');
	}
	if (!Array.isArray(crops)) {
		error(400, 'crops must be an array of CDL value IDs');
	}
	// Critical #3: Validate each crop value is a number
	if (!crops.every((c) => typeof c === 'number')) {
		error(400, 'Each crop value must be a number');
	}

	// Compute bounding boxes
	const { albers, latLon } = computeSearchBbox(lat, lon, radius);

	try {
		// Fetch CDL data
		const pngUrl = await fetchCdlData({ year, albers, crops }, fetch);

		// Important #4: Validate pngUrl from CDL API
		if (typeof pngUrl !== 'string' || pngUrl.trim() === '') {
			error(502, 'CDL API returned invalid or empty image URL');
		}

		return json({
			pngUrl,
			bounds: [
				[latLon.south, latLon.west],
				[latLon.north, latLon.east]
			]
		});
	} catch (err) {
		console.error('CDL API error:', err);
		error(502, 'Failed to fetch crop data from CDL API');
	}
};
