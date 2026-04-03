// Pure lat/lon math — no proj4, safe to import on client and server.

export interface LatLonBbox {
	south: number;
	north: number;
	west: number;
	east: number;
}

/**
 * Compute a bounding box in lat/lon from a center point and radius in miles.
 * Uses the simple degrees-per-mile approximation from ff.py.
 */
export function computeBboxLatLon(lat: number, lon: number, radiusMiles: number): LatLonBbox {
	const latDelta = radiusMiles / 69.0;
	const lonDelta = radiusMiles / (69.0 * Math.cos((lat * Math.PI) / 180));

	return {
		south: lat - latDelta,
		north: lat + latDelta,
		west: lon - lonDelta,
		east: lon + lonDelta
	};
}
