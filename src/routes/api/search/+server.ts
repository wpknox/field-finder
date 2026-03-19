import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { computeSearchBbox } from '$lib/server/coordinates';
import { fetchCdlData } from '$lib/server/cdl';

export const POST: RequestHandler = async ({ request, fetch }) => {
	const body = await request.json();

	// Validate required fields
	const { lat, lon, radius, year, crops } = body;
	if (typeof lat !== 'number' || typeof lon !== 'number') {
		error(400, 'lat and lon are required numbers');
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

	// Compute bounding boxes
	const { albers, latLon } = computeSearchBbox(lat, lon, radius);

	try {
		// Fetch CDL data
		const pngUrl = await fetchCdlData(
			{ year, albers, crops },
			fetch
		);

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
