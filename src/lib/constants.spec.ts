import { describe, it, expect } from 'vitest';
import { CDL_MIN_YEAR, CDL_MAX_YEAR, CDL_YEARS } from './constants';

describe('CDL year constants', () => {
	it('spans a sane range', () => {
		expect(CDL_MIN_YEAR).toBe(1997);
		expect(CDL_MAX_YEAR).toBeGreaterThanOrEqual(2024);
	});

	it('CDL_YEARS lists every year newest-first', () => {
		expect(CDL_YEARS[0]).toBe(CDL_MAX_YEAR);
		expect(CDL_YEARS[CDL_YEARS.length - 1]).toBe(CDL_MIN_YEAR);
		expect(CDL_YEARS).toHaveLength(CDL_MAX_YEAR - CDL_MIN_YEAR + 1);
	});
});
