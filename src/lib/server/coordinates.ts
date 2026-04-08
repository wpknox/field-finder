import proj4 from 'proj4';
export { computeBboxLatLon, type LatLonBbox } from '$lib/geo';
import { computeBboxLatLon, type LatLonBbox } from '$lib/geo';
import { EPSG_5070 } from '$lib/projections';

const EPSG_4326 = 'EPSG:4326'; // WGS84 lat/lon

export interface AlbersBbox {
	xMin: number;
	yMin: number;
	xMax: number;
	yMax: number;
}

/** Project a single point from EPSG:4326 (lon, lat) to EPSG:5070 (x, y). */
export function projectToAlbers(lon: number, lat: number): [number, number] {
	return proj4(EPSG_4326, EPSG_5070, [lon, lat]) as [number, number];
}

/** Project a single point from EPSG:5070 (x, y) to EPSG:4326 (lon, lat). */
export function projectToLatLon(x: number, y: number): [number, number] {
	return proj4(EPSG_5070, EPSG_4326, [x, y]) as [number, number];
}

/**
 * Compute both Albers (for CDL API) and lat/lon (for Leaflet) bounding boxes.
 * Algorithm: compute bbox in lat/lon, then project corners to Albers.
 */
export function computeSearchBbox(
	lat: number,
	lon: number,
	radiusMiles: number
): { albers: AlbersBbox; latLon: LatLonBbox } {
	const latLon = computeBboxLatLon(lat, lon, radiusMiles);

	// Project the four corners to Albers
	const sw = projectToAlbers(latLon.west, latLon.south);
	const ne = projectToAlbers(latLon.east, latLon.north);
	const nw = projectToAlbers(latLon.west, latLon.north);
	const se = projectToAlbers(latLon.east, latLon.south);

	// Use min/max of all four corners to get the Albers bbox
	const xs = [sw[0], ne[0], nw[0], se[0]];
	const ys = [sw[1], ne[1], nw[1], se[1]];

	return {
		albers: {
			xMin: Math.min(...xs),
			yMin: Math.min(...ys),
			xMax: Math.max(...xs),
			yMax: Math.max(...ys)
		},
		latLon
	};
}
