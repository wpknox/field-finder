/**
 * Convert a single-band raster into an RGBA byte array using the palette
 * embedded in the GeoTIFF (georaster.palette — 256 [r,g,b,a] entries indexed
 * by CDL value). noData and unmapped values become fully transparent so the
 * base map shows through.
 */
export function rasterToRgba(
	band: number[][],
	width: number,
	height: number,
	noDataValue: number | null,
	palette: Array<[number, number, number, number]> | null | undefined
): Uint8ClampedArray<ArrayBuffer> {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let row = 0; row < height; row++) {
		for (let col = 0; col < width; col++) {
			const val = band[row][col];
			const i = (row * width + col) * 4;
			if (val === noDataValue || !palette?.[val]) continue; // stays transparent (0,0,0,0)
			const [r, g, b, a] = palette[val];
			data[i] = r;
			data[i + 1] = g;
			data[i + 2] = b;
			data[i + 3] = a;
		}
	}
	return data;
}

/** Browser-only: paint the raster to a canvas at native resolution and return a PNG data URL. */
export function rasterToDataUrl(
	band: number[][],
	width: number,
	height: number,
	noDataValue: number | null,
	palette: Array<[number, number, number, number]> | null | undefined
): string {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	ctx.putImageData(
		new ImageData(rasterToRgba(band, width, height, noDataValue, palette), width, height),
		0,
		0
	);
	return canvas.toDataURL('image/png');
}
