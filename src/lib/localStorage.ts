export interface Waypoint {
	lat: number;
	lon: number;
	name?: string;
}

const KEYS = {
	location: 'ff-last-location',
	radius: 'ff-last-radius',
	crops: 'ff-crop-filters',
	sidebar: 'ff-sidebar-collapsed',
	waypoints: 'ff-waypoints'
} as const;

function safeGet<T>(key: string, storage?: Storage): T | null {
	try {
		const raw = storage?.getItem(key);
		if (raw === null || raw === undefined) return null;
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

function safeSet(key: string, value: unknown, storage?: Storage): void {
	try {
		storage?.setItem(key, JSON.stringify(value));
	} catch {
		// localStorage full or unavailable — silently fail
	}
}

// Location
export function saveLastLocation(
	loc: { lat: number; lon: number },
	storage?: Storage
): void {
	safeSet(KEYS.location, loc, storage);
}
export function getLastLocation(
	storage?: Storage
): { lat: number; lon: number } | null {
	return safeGet(KEYS.location, storage);
}

// Radius
export function saveLastRadius(radius: number, storage?: Storage): void {
	safeSet(KEYS.radius, radius, storage);
}
export function getLastRadius(storage?: Storage): number | null {
	return safeGet(KEYS.radius, storage);
}

// Crop filters
export function saveCropFilters(
	filters: Record<string, boolean>,
	storage?: Storage
): void {
	safeSet(KEYS.crops, filters, storage);
}
export function getCropFilters(
	storage?: Storage
): Record<string, boolean> | null {
	return safeGet(KEYS.crops, storage);
}

// Sidebar
export function saveSidebarCollapsed(
	collapsed: boolean,
	storage?: Storage
): void {
	safeSet(KEYS.sidebar, collapsed, storage);
}
export function getSidebarCollapsed(storage?: Storage): boolean | null {
	return safeGet(KEYS.sidebar, storage);
}

// Waypoints
export function saveWaypoints(waypoints: Waypoint[], storage?: Storage): void {
	safeSet(KEYS.waypoints, waypoints, storage);
}
export function getWaypoints(storage?: Storage): Waypoint[] {
	return safeGet<Waypoint[]>(KEYS.waypoints, storage) ?? [];
}
