export const CROPS = {
	sorghum: { id: 4, name: 'Sorghum', color: '#FF8C00' },
	winterWheat: { id: 24, name: 'Winter Wheat', color: '#8B4513' },
	springWheat: { id: 23, name: 'Spring Wheat', color: '#D2B48C' },
	corn: { id: 1, name: 'Corn', color: '#FFFF00' },
	soybeans: { id: 5, name: 'Soybeans', color: '#008000' },
	sunflower: { id: 6, name: 'Sunflower', color: '#DAA520' },
	oats: { id: 28, name: 'Oats', color: '#800080' },
	barley: { id: 21, name: 'Barley', color: '#FF00FF' },
	alfalfa: { id: 36, name: 'Alfalfa', color: '#FFC0CB' },
	pasture: { id: 176, name: 'Pasture/Grass', color: '#90EE90' },
	fallow: { id: 61, name: 'Fallow/Idle', color: '#808080' },
	openWater: { id: 111, name: 'Open Water', color: '#4169E1' },
	wetlands: { id: 190, name: 'Wetlands/Rivers', color: '#ADD8E6' }
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
