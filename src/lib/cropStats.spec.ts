import { describe, it, expect } from 'vitest';
import { computeCropStats } from './cropStats';

describe('computeCropStats', () => {
	it('counts pixel values and returns sorted percentages', () => {
		// 3x3 grid: 4 corn, 3 sorghum, 2 nodata(0)
		const values = [
			[
				[1, 1, 4],
				[1, 4, 4],
				[0, 0, 1]
			]
		];
		const stats = computeCropStats(values, 0);

		// Excludes nodata (0), so total = 7
		expect(stats).toHaveLength(2);
		expect(stats[0]).toEqual({
			id: 1,
			name: 'Corn',
			color: '#FFFF00',
			count: 4,
			percentage: (4 / 7) * 100
		});
		expect(stats[1]).toEqual({
			id: 4,
			name: 'Sorghum',
			color: '#FF8C00',
			count: 3,
			percentage: (3 / 7) * 100
		});
	});

	it('labels unknown crop IDs as "Other (ID: <n>)"', () => {
		const values = [[[999, 999, 1]]];
		const stats = computeCropStats(values, 0);

		expect(stats[0]).toMatchObject({
			id: 999,
			name: 'Other (ID: 999)',
			color: '#C0C0C0',
			count: 2
		});
	});

	it('returns empty array for all-nodata raster', () => {
		const values = [[[0, 0], [0, 0]]];
		const stats = computeCropStats(values, 0);
		expect(stats).toEqual([]);
	});

	it('treats null noDataValue as no exclusion', () => {
		const values = [[[0, 0, 1]]];
		const stats = computeCropStats(values, null);

		expect(stats).toHaveLength(2);
		// 0 is included since noDataValue is null
		expect(stats.find((s) => s.id === 0)).toBeDefined();
	});
});
