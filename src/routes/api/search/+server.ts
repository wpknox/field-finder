import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { computeSearchBbox } from '$lib/server/coordinates';
import { fetchCdlData, type CdlProgressStep } from '$lib/server/cdl';

const PROGRESS_MESSAGES: Record<CdlProgressStep, string> = {
	fetching: 'Fetching crop data...',
	extracting: 'Extracting crop information...'
};

export const POST: RequestHandler = async ({ request, fetch }) => {
	// Handle JSON parse errors
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
	if (!crops.every((c) => typeof c === 'number')) {
		error(400, 'Each crop value must be a number');
	}

	const { albers } = computeSearchBbox(lat, lon, radius);
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			const send = (data: object) => {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
			};

			try {
				const rasterUrl = await fetchCdlData(
					{ year, albers, crops },
					fetch,
					(step) => send({ type: 'progress', message: PROGRESS_MESSAGES[step] })
				);

				if (typeof rasterUrl !== 'string' || rasterUrl.trim() === '') {
					send({ type: 'error', message: 'CDL API returned an invalid raster URL' });
					return;
				}

				send({ type: 'progress', message: 'Downloading crop data...' });
				const tifResp = await fetch(rasterUrl);
				if (!tifResp.ok) {
					send({
						type: 'error',
						message: 'Failed to download crop data from CDL server'
					});
					return;
				}

				const tifBuffer = await tifResp.arrayBuffer();
				const tifBase64 = Buffer.from(tifBuffer).toString('base64');

				send({ type: 'done', tifBase64 });
			} catch (err) {
				console.error('CDL API error:', err);
				send({ type: 'error', message: 'Failed to fetch crop data from CDL API' });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache'
		}
	});
};
