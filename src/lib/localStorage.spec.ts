import { describe, it, expect, beforeEach } from 'vitest';
import {
	saveLastLocation,
	getLastLocation,
	saveLastRadius,
	getLastRadius,
	saveCropFilters,
	getCropFilters,
	saveSidebarCollapsed,
	getSidebarCollapsed,
	saveWaypoints,
	getWaypoints,
	type Waypoint
} from './localStorage';

// Mock localStorage for Node test environment
const store: Record<string, string> = {};
const mockLocalStorage = {
	getItem: (key: string) => store[key] ?? null,
	setItem: (key: string, val: string) => {
		store[key] = val;
	},
	removeItem: (key: string) => {
		delete store[key];
	}
} as Storage;

beforeEach(() => {
	Object.keys(store).forEach((k) => delete store[k]);
});

describe('localStorage helpers', () => {
	it('saves and retrieves last location', () => {
		saveLastLocation({ lat: 40.554, lon: -100.076 }, mockLocalStorage);
		expect(getLastLocation(mockLocalStorage)).toEqual({ lat: 40.554, lon: -100.076 });
	});

	it('returns null when no location is saved', () => {
		expect(getLastLocation(mockLocalStorage)).toBeNull();
	});

	it('saves and retrieves last radius', () => {
		saveLastRadius(15, mockLocalStorage);
		expect(getLastRadius(mockLocalStorage)).toBe(15);
	});

	it('returns null when no radius is saved', () => {
		expect(getLastRadius(mockLocalStorage)).toBeNull();
	});

	it('saves and retrieves crop filter state', () => {
		const filters = { sorghum: true, corn: false, wheat: true };
		saveCropFilters(filters, mockLocalStorage);
		expect(getCropFilters(mockLocalStorage)).toEqual(filters);
	});

	it('returns null when no crop filters saved', () => {
		expect(getCropFilters(mockLocalStorage)).toBeNull();
	});

	it('saves and retrieves sidebar collapsed state', () => {
		saveSidebarCollapsed(true, mockLocalStorage);
		expect(getSidebarCollapsed(mockLocalStorage)).toBe(true);
	});

	it('saves and retrieves waypoints', () => {
		const waypoints: Waypoint[] = [
			{ lat: 40.5, lon: -100.1 },
			{ lat: 40.6, lon: -100.2, name: 'Good milo field' }
		];
		saveWaypoints(waypoints, mockLocalStorage);
		expect(getWaypoints(mockLocalStorage)).toEqual(waypoints);
	});

	it('returns empty array when no waypoints saved', () => {
		expect(getWaypoints(mockLocalStorage)).toEqual([]);
	});

	it('handles corrupted JSON gracefully', () => {
		store['ff-last-location'] = '{not valid json';
		expect(getLastLocation(mockLocalStorage)).toBeNull();
	});
});
