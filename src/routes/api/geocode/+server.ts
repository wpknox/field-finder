import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { geocode } from '$lib/server/geocode';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	if (!query || query.trim().length === 0) {
		error(400, 'Query parameter "q" is required');
	}

	const results = await geocode(query.trim());
	return json(results);
};
