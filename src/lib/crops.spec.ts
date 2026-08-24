import { describe, it, expect } from 'vitest';
import {
	CROPS,
	getCropById,
	getAllCrops,
	paletteColor,
	resolveCropColors,
	type CdlPalette
} from './crops';

// Colors below are the ground-truth values from the CDL GeoTIFF's embedded
// colormap (georaster.palette[id]), captured from a live CDL response. They must
// stay in sync with what the overlay renderer actually paints.
describe('crops config', () => {
	it('exports a CROPS object with known crop entries', () => {
		expect(CROPS.sorghum).toEqual({ id: 4, name: 'Sorghum', color: '#FF9E0A' });
		expect(CROPS.openWater).toEqual({ id: 111, name: 'Open Water', color: '#4A6FA2' });
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
		expect(getCropById(4)).toEqual({ id: 4, name: 'Sorghum', color: '#FF9E0A' });
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

/**
 * Builds a sparse 256-entry palette in the shape georaster produces, populated
 * only at the CDL IDs given. Every other slot is left undefined, which is what a
 * real colormap looks like for values the raster never uses.
 */
function makePalette(entries: Record<number, [number, number, number, number]>): CdlPalette {
	const palette = new Array(256) as CdlPalette;
	for (const [id, rgba] of Object.entries(entries)) {
		palette[Number(id)] = rgba;
	}
	return palette;
}

describe('paletteColor', () => {
	it('returns an rgb() string for a usable palette entry', () => {
		const palette = makePalette({ 1: [255, 210, 0, 255] });
		expect(paletteColor(palette, 1)).toBe('rgb(255, 210, 0)');
	});

	it('returns null when the palette is absent', () => {
		expect(paletteColor(null, 1)).toBeNull();
		expect(paletteColor(undefined, 1)).toBeNull();
	});

	it('returns null for a missing entry', () => {
		expect(paletteColor(makePalette({ 1: [255, 210, 0, 255] }), 4)).toBeNull();
	});

	it('returns null for a fully transparent entry', () => {
		expect(paletteColor(makePalette({ 4: [255, 158, 10, 0] }), 4)).toBeNull();
	});

	it('returns null for a malformed entry', () => {
		const palette = new Array(256) as CdlPalette;
		// Short tuple — not enough channels to build a color from.
		palette[4] = [255, 158] as unknown as [number, number, number, number];
		expect(paletteColor(palette, 4)).toBeNull();
	});
});

describe('resolveCropColors', () => {
	it('returns the palette color for every crop the palette covers', () => {
		const palette = makePalette({
			1: [1, 2, 3, 255],
			4: [4, 5, 6, 255],
			5: [7, 8, 9, 255],
			6: [10, 11, 12, 255],
			21: [13, 14, 15, 255],
			23: [16, 17, 18, 255],
			24: [19, 20, 21, 255],
			28: [22, 23, 24, 255],
			36: [25, 26, 27, 255],
			61: [28, 29, 30, 255],
			111: [31, 32, 33, 255],
			176: [34, 35, 36, 255],
			190: [37, 38, 39, 255]
		});
		const colors = resolveCropColors(palette);

		expect(colors.corn).toBe('rgb(1, 2, 3)');
		expect(colors.sorghum).toBe('rgb(4, 5, 6)');
		expect(colors.barley).toBe('rgb(13, 14, 15)');
		expect(colors.oats).toBe('rgb(22, 23, 24)');
		expect(colors.alfalfa).toBe('rgb(25, 26, 27)');
		expect(colors.wetlands).toBe('rgb(37, 38, 39)');
	});

	it('falls back to the hardcoded CROPS colors when no palette is available', () => {
		for (const palette of [null, undefined]) {
			const colors = resolveCropColors(palette);
			expect(colors.corn).toBe('#FFD200');
			expect(colors.sorghum).toBe('#FF9E0A');
			expect(colors.barley).toBe('#E1007B');
			expect(colors.oats).toBe('#9F5888');
			expect(colors.alfalfa).toBe('#FFA4E1');
			expect(colors.openWater).toBe('#4A6FA2');
			expect(Object.keys(colors).sort()).toEqual(Object.keys(CROPS).sort());
		}
	});

	it('falls back per-crop when the palette lacks a usable entry for that ID', () => {
		const palette = makePalette({
			1: [1, 2, 3, 255],
			// 21 (barley) omitted entirely
			36: [0, 0, 0, 0] // alfalfa present but fully transparent
		});
		const colors = resolveCropColors(palette);

		expect(colors.corn).toBe('rgb(1, 2, 3)');
		expect(colors.barley).toBe('#E1007B');
		expect(colors.alfalfa).toBe('#FFA4E1');
	});

	it('returns an entry for every crop key', () => {
		const colors = resolveCropColors(makePalette({ 1: [1, 2, 3, 255] }));
		expect(Object.keys(colors).sort()).toEqual(Object.keys(CROPS).sort());
	});
});
