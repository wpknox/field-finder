import { getCropById, CDL_LABELS } from './crops';

export interface CropStat {
	id: number;
	name: string;
	color: string;
	count: number;
	percentage: number;
}

/**
 * Count pixel values from a georaster and return sorted crop statistics.
 * @param values - georaster.values (band × row × col)
 * @param noDataValue - value to exclude (typically 0), or null to include all
 * @param palette - georaster.palette (256-entry RGBA array indexed by CDL value)
 */
export function computeCropStats(
	values: number[][][],
	noDataValue: number | null,
	palette?: Array<[number, number, number, number]> | null
): CropStat[] {
	const counts = new Map<number, number>();
	let total = 0;

	const band = values[0];
	for (const row of band) {
		for (const val of row) {
			if (noDataValue !== null && val === noDataValue) continue;
			counts.set(val, (counts.get(val) ?? 0) + 1);
			total++;
		}
	}

	if (total === 0) return [];

	const stats: CropStat[] = [];
	for (const [id, count] of counts) {
		const crop = getCropById(id);
		const name = crop?.name ?? CDL_LABELS[id] ?? `Unknown (ID: ${id})`;

		let color = crop?.color ?? '#C0C0C0';
		if (palette?.[id]) {
			const [r, g, b] = palette[id];
			color = `rgb(${r}, ${g}, ${b})`;
		}

		stats.push({ id, name, color, count, percentage: (count / total) * 100 });
	}

	stats.sort((a, b) => b.percentage - a.percentage);
	return stats;
}
