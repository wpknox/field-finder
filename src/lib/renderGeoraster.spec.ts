import { describe, it, expect } from 'vitest';
import { rasterToRgba } from './renderGeoraster';

const palette: Array<[number, number, number, number]> = new Array(256).fill([0, 0, 0, 255]);
palette[1] = [255, 212, 0, 255]; // corn
palette[5] = [38, 115, 0, 255]; // soybeans

describe('rasterToRgba', () => {
	it('maps pixel values to palette colors at full resolution', () => {
		const band = [
			[1, 5],
			[5, 1]
		];
		const rgba = rasterToRgba(band, 2, 2, 0, palette);
		expect(rgba.length).toBe(2 * 2 * 4);
		expect([...rgba.slice(0, 4)]).toEqual([255, 212, 0, 255]); // (0,0) = corn
		expect([...rgba.slice(4, 8)]).toEqual([38, 115, 0, 255]); // (0,1) = soybeans
	});

	it('renders noData pixels fully transparent', () => {
		const band = [[0]];
		const rgba = rasterToRgba(band, 1, 1, 0, palette);
		expect(rgba[3]).toBe(0);
	});

	it('renders values missing from the palette as transparent', () => {
		const band = [[7]];
		const rgba = rasterToRgba(band, 1, 1, 0, null);
		expect(rgba[3]).toBe(0);
	});
});
