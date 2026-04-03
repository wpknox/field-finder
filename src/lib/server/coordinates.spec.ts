import { describe, it, expect } from 'vitest';
import {
	computeBboxLatLon,
	projectToAlbers,
	projectToLatLon,
	computeSearchBbox
} from './coordinates';

describe('computeBboxLatLon', () => {
	it('computes a bounding box from center + radius in miles', () => {
		const bbox = computeBboxLatLon(40.554, -100.076, 10);
		// 10 miles / 69.0 ≈ 0.1449 degrees latitude
		expect(bbox.south).toBeCloseTo(40.554 - 10 / 69.0, 3);
		expect(bbox.north).toBeCloseTo(40.554 + 10 / 69.0, 3);
		// longitude degrees are wider at this latitude
		const lonDelta = 10 / (69.0 * Math.cos((40.554 * Math.PI) / 180));
		expect(bbox.west).toBeCloseTo(-100.076 - lonDelta, 3);
		expect(bbox.east).toBeCloseTo(-100.076 + lonDelta, 3);
	});
});

describe('projectToAlbers', () => {
	it('projects EPSG:4326 to EPSG:5070', () => {
		const [x, y] = projectToAlbers(-100.076, 40.554);
		expect(x).toBeTypeOf('number');
		expect(y).toBeTypeOf('number');
		expect(Math.abs(x)).toBeLessThan(3_000_000);
		expect(y).toBeGreaterThan(0);
	});
});

describe('projectToLatLon', () => {
	it('round-trips a projection', () => {
		const [x, y] = projectToAlbers(-100.076, 40.554);
		const [lon, lat] = projectToLatLon(x, y);
		expect(lon).toBeCloseTo(-100.076, 4);
		expect(lat).toBeCloseTo(40.554, 4);
	});
});

describe('computeSearchBbox', () => {
	it('returns both Albers and lat/lon bounding boxes', () => {
		const result = computeSearchBbox(40.554, -100.076, 10);

		expect(result.albers).toHaveProperty('xMin');
		expect(result.albers).toHaveProperty('yMin');
		expect(result.albers).toHaveProperty('xMax');
		expect(result.albers).toHaveProperty('yMax');
		expect(result.albers.xMin).toBeLessThan(result.albers.xMax);
		expect(result.albers.yMin).toBeLessThan(result.albers.yMax);

		expect(result.latLon).toHaveProperty('south');
		expect(result.latLon).toHaveProperty('north');
		expect(result.latLon.south).toBeCloseTo(40.554 - 10 / 69.0, 3);
	});

	it('produces a larger box for a larger radius', () => {
		const small = computeSearchBbox(40.554, -100.076, 5);
		const large = computeSearchBbox(40.554, -100.076, 15);
		const smallWidth = small.albers.xMax - small.albers.xMin;
		const largeWidth = large.albers.xMax - large.albers.xMin;
		expect(largeWidth).toBeGreaterThan(smallWidth);
	});
});
