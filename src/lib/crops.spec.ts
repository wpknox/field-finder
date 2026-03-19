import { describe, it, expect } from 'vitest';
import { CROPS, getCropById, getAllCrops } from './crops';

describe('crops config', () => {
	it('exports a CROPS object with known crop entries', () => {
		expect(CROPS.sorghum).toEqual({ id: 4, name: 'Sorghum', color: '#FF8C00' });
		expect(CROPS.openWater).toEqual({ id: 111, name: 'Open Water', color: '#4169E1' });
	});

	it('every crop has id, name, and color', () => {
		for (const [key, crop] of Object.entries(CROPS)) {
			expect(crop.id, `${key} missing id`).toBeTypeOf('number');
			expect(crop.name, `${key} missing name`).toBeTypeOf('string');
			expect(crop.color, `${key} missing color`).toMatch(/^#[0-9A-Fa-f]{6}$/);
		}
	});

	it('has no duplicate CDL IDs', () => {
		const ids = Object.values(CROPS).map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('getCropById returns the correct crop', () => {
		expect(getCropById(4)).toEqual({ id: 4, name: 'Sorghum', color: '#FF8C00' });
	});

	it('getCropById returns undefined for unknown ID', () => {
		expect(getCropById(9999)).toBeUndefined();
	});

	it('getAllCrops returns an array of all crops with their keys', () => {
		const all = getAllCrops();
		expect(all.length).toBe(Object.keys(CROPS).length);
		expect(all[0]).toHaveProperty('key');
		expect(all[0]).toHaveProperty('id');
		expect(all[0]).toHaveProperty('name');
		expect(all[0]).toHaveProperty('color');
	});
});
