/**
 * Range of years the USDA CDL publishes a Cropland Data Layer for.
 *
 * NASS releases the previous year's layer each winter. When a new layer lands,
 * bump CDL_MAX_YEAR here — it is the single source of truth for the year
 * dropdown, the default selection, and server-side request validation.
 */
export const CDL_MIN_YEAR = 1997;
export const CDL_MAX_YEAR = 2024;

/** Every selectable CDL year, newest first (dropdown order). */
export const CDL_YEARS = Array.from(
	{ length: CDL_MAX_YEAR - CDL_MIN_YEAR + 1 },
	(_, i) => CDL_MAX_YEAR - i
);
