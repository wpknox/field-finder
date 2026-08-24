/** Complete CDL value → display name lookup. Used for AreaSummary stats labeling. */
export const CDL_LABELS: Record<number, string> = {
	1: 'Corn',
	2: 'Cotton',
	3: 'Rice',
	4: 'Sorghum',
	5: 'Soybeans',
	6: 'Sunflower',
	10: 'Peanuts',
	11: 'Tobacco',
	12: 'Sweet Corn',
	13: 'Pop or Orn Corn',
	14: 'Mint',
	21: 'Barley',
	22: 'Durum Wheat',
	23: 'Spring Wheat',
	24: 'Winter Wheat',
	25: 'Other Small Grains',
	26: 'Dbl Crop WinWht/Soybeans',
	27: 'Rye',
	28: 'Oats',
	29: 'Millet',
	30: 'Speltz',
	31: 'Canola',
	32: 'Flaxseed',
	33: 'Safflower',
	34: 'Brassica napus',
	35: 'Mustard',
	36: 'Alfalfa',
	37: 'Other Hay/Non Alfalfa',
	38: 'Camelina',
	39: 'Buckwheat',
	41: 'Sugarbeets',
	42: 'Dry Beans',
	43: 'Potatoes',
	44: 'Other Crops',
	45: 'Sugarcane',
	46: 'Sweet Potatoes',
	47: 'Misc Vegs & Fruits',
	48: 'Watermelons',
	49: 'Onions',
	50: 'Cucumbers',
	51: 'Chick Peas',
	52: 'Lentils',
	53: 'Peas',
	54: 'Tomatoes',
	55: 'Caneberries',
	56: 'Hops',
	57: 'Herbs',
	58: 'Clover/Wildflowers',
	59: 'Sod/Grass Seed',
	60: 'Switchgrass',
	61: 'Fallow/Idle Cropland',
	66: 'Cherries',
	67: 'Peaches',
	68: 'Apples',
	69: 'Grapes',
	70: 'Christmas Trees',
	71: 'Other Tree Crops',
	72: 'Citrus',
	74: 'Pecans',
	75: 'Almonds',
	76: 'Walnuts',
	77: 'Pears',
	81: 'Clouds/No Data',
	92: 'Aquaculture',
	111: 'Open Water',
	112: 'Perennial Ice/Snow',
	121: 'Developed/Open Space',
	122: 'Developed/Low Intensity',
	123: 'Developed/Med Intensity',
	124: 'Developed/High Intensity',
	131: 'Barren',
	141: 'Deciduous Forest',
	142: 'Evergreen Forest',
	143: 'Mixed Forest',
	152: 'Shrubland',
	176: 'Grassland/Pasture',
	190: 'Woody Wetlands',
	195: 'Herbaceous Wetlands',
	204: 'Pistachios',
	205: 'Triticale',
	206: 'Carrots',
	207: 'Asparagus',
	208: 'Garlic',
	209: 'Cantaloupes',
	211: 'Olives',
	212: 'Oranges',
	213: 'Honeydew Melons',
	214: 'Broccoli',
	215: 'Avocados',
	216: 'Peppers',
	217: 'Pomegranates',
	218: 'Nectarines',
	219: 'Greens',
	220: 'Plums',
	221: 'Strawberries',
	222: 'Squash',
	223: 'Apricots',
	224: 'Vetch',
	225: 'Dbl Crop WinWht/Corn',
	226: 'Dbl Crop Oats/Corn',
	227: 'Lettuce',
	228: 'Dbl Crop Triticale/Corn',
	229: 'Pumpkins',
	231: 'Dbl Crop Lettuce/Cantaloupe',
	232: 'Dbl Crop Lettuce/Cotton',
	233: 'Dbl Crop Lettuce/Barley',
	236: 'Dbl Crop WinWht/Sorghum',
	237: 'Dbl Crop Barley/Corn',
	238: 'Dbl Crop WinWht/Cotton',
	239: 'Dbl Crop Soybeans/Cotton',
	240: 'Dbl Crop Soybeans/Oats',
	241: 'Dbl Crop Corn/Soybeans',
	242: 'Blueberries',
	243: 'Cabbage',
	244: 'Cauliflower',
	245: 'Celery',
	246: 'Radishes',
	247: 'Turnips',
	248: 'Eggplants',
	249: 'Gourds',
	250: 'Cranberries',
	254: 'Dbl Crop Barley/Soybeans'
};

/**
 * Crop filter/legend entries.
 *
 * `color` is the ground-truth RGB from the CDL GeoTIFF's embedded colormap
 * (`georaster.palette[id]`), captured from a live CDL response for the Eustis,
 * NE reference area (year 2024). The overlay renderer paints each pixel with
 * exactly `palette[value]`, so these hexes make the sidebar swatches and the map
 * legend pixel-match the rendered overlay.
 *
 * Note: a few entries differ by 1 from the colors published on the CropScape
 * legend page (e.g. corn is #FFD200 here, not #FFD300). The raster's colormap is
 * authoritative — its 16-bit entries are exact multiples of 257, so these are
 * not rounding artifacts.
 */
export const CROPS = {
	corn: { id: 1, name: 'Corn', color: '#FFD200' },
	sorghum: { id: 4, name: 'Sorghum', color: '#FF9E0A' },
	soybeans: { id: 5, name: 'Soybeans', color: '#256F00' },
	sunflower: { id: 6, name: 'Sunflower', color: '#FFFF00' },
	barley: { id: 21, name: 'Barley', color: '#E1007B' },
	springWheat: { id: 23, name: 'Spring Wheat', color: '#D7B56B' },
	winterWheat: { id: 24, name: 'Winter Wheat', color: '#A46F00' },
	oats: { id: 28, name: 'Oats', color: '#9F5888' },
	alfalfa: { id: 36, name: 'Alfalfa', color: '#FFA4E1' },
	fallow: { id: 61, name: 'Fallow/Idle', color: '#BEBE77' },
	openWater: { id: 111, name: 'Open Water', color: '#4A6FA2' },
	pasture: { id: 176, name: 'Grassland/Pasture', color: '#E8FFBE' },
	wetlands: { id: 190, name: 'Woody Wetlands', color: '#7DB0B0' }
} as const;

export type CropKey = keyof typeof CROPS;
export type CropEntry = (typeof CROPS)[CropKey];

/** Look up a crop by its CDL numeric ID. */
export function getCropById(id: number): CropEntry | undefined {
	return Object.values(CROPS).find((c) => c.id === id);
}

/** Return all crops as an array with their config key included. */
export function getAllCrops(): Array<{ key: CropKey } & CropEntry> {
	return Object.entries(CROPS).map(([key, crop]) => ({
		key: key as CropKey,
		...crop
	}));
}

/** `georaster.palette` — 256 `[r, g, b, a]` tuples indexed by CDL value. Sparse. */
export type CdlPalette = Array<[number, number, number, number]>;

/** Effective display color per crop key. */
export type CropColors = Record<CropKey, string>;

function isChannel(n: unknown): boolean {
	return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 255;
}

/**
 * Convert one palette entry to a CSS color string.
 *
 * Returns null when the palette is absent, has no entry for `id`, or the entry
 * is unusable (malformed tuple or fully transparent) — callers fall back to
 * their own default in that case.
 */
export function paletteColor(palette: CdlPalette | null | undefined, id: number): string | null {
	const entry = palette?.[id];
	if (!Array.isArray(entry) || entry.length < 3) return null;
	const [r, g, b, a] = entry;
	if (!isChannel(r) || !isChannel(g) || !isChannel(b)) return null;
	if (a === 0) return null;
	return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Resolve the color to display for each crop in the filter list and legend.
 *
 * The rendered overlay is painted straight from `georaster.palette`, so when a
 * raster is loaded that palette is authoritative and its colors win. Before any
 * search — or for any ID the palette doesn't usably cover — the hardcoded
 * `CROPS[key].color` is used instead, so the UI is correct on first paint.
 */
export function resolveCropColors(palette?: CdlPalette | null): CropColors {
	const colors = {} as CropColors;
	for (const [key, crop] of Object.entries(CROPS) as Array<[CropKey, CropEntry]>) {
		colors[key] = paletteColor(palette, crop.id) ?? crop.color;
	}
	return colors;
}
