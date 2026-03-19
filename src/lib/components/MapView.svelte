<script lang="ts">
	import { onMount } from 'svelte';
	import { computeBboxLatLon } from '$lib/geo';
	import Legend from './Legend.svelte';
	import type { Waypoint } from '$lib/localStorage';

	let {
		center = $bindable<[number, number]>([39.8, -98.5]),
		zoom = 5,
		radius = 10,
		overlayUrl = '',
		overlayBounds = undefined as [[number, number], [number, number]] | undefined,
		loading = false,
		errorMessage = '',
		waypoints = $bindable<Waypoint[]>([]),
		onMapClick
	}: {
		center?: [number, number];
		zoom?: number;
		radius?: number;
		overlayUrl?: string;
		overlayBounds?: [[number, number], [number, number]];
		loading?: boolean;
		errorMessage?: string;
		waypoints?: Waypoint[];
		onMapClick?: (lat: number, lon: number) => void;
	} = $props();

	let mapContainer: HTMLDivElement;
	let mapReady = $state(false);

	let map: import('leaflet').Map | undefined;
	let marker: import('leaflet').Marker | undefined;
	let bboxRect: import('leaflet').Rectangle | undefined;
	let overlay: import('leaflet').ImageOverlay | undefined;

	// Stable per-session ID counter for waypoint markers
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const waypointMarkers = new Map<number, import('leaflet').Marker>();
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const waypointData = new Map<number, Waypoint>(); // id → waypoint
	let waypointIdCounter = 0;
	const cleanupFns: Array<() => void> = [];
	let restoredFromStorage = false;

	onMount(() => {
		import('leaflet').then((L) => {
			map = L.map(mapContainer).setView(center, zoom);

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map);

			map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
				onMapClick?.(e.latlng.lat, e.latlng.lng);
			});

			map.on('contextmenu', (e: import('leaflet').LeafletMouseEvent) => {
				const id = waypointIdCounter++;
				const waypoint: Waypoint = { lat: e.latlng.lat, lon: e.latlng.lng };
				waypointData.set(id, waypoint);
				waypoints = [...waypointData.values()];
				addWaypointMarker(L, map!, waypoint, id);
			});

			mapReady = true;
		});

		return () => {
			cleanupFns.forEach((fn) => fn());
			map?.remove();
		};
	});

	// Sync markers with waypoints from localStorage on load
	$effect(() => {
		if (!mapReady || restoredFromStorage) return;
		restoredFromStorage = true;
		import('leaflet').then((L) => {
			waypoints.forEach((wp) => {
				const id = waypointIdCounter++;
				waypointData.set(id, wp);
				addWaypointMarker(L, map!, wp, id);
			});
		});
	});

	// Location marker — updates when center changes
	$effect(() => {
		if (!mapReady || !map) return;
		const [lat, lon] = center;
		if (marker) {
			marker.setLatLng([lat, lon]);
		} else {
			import('leaflet').then((L) => {
				marker = L.marker([lat, lon]).addTo(map!);
			});
		}
	});

	// Bounding box rectangle — updates when center or radius changes
	$effect(() => {
		if (!mapReady || !map) return;
		const bbox = computeBboxLatLon(center[0], center[1], radius);
		const bounds: [[number, number], [number, number]] = [
			[bbox.south, bbox.west],
			[bbox.north, bbox.east]
		];
		if (bboxRect) {
			bboxRect.setBounds(bounds);
		} else {
			import('leaflet').then((L) => {
				bboxRect = L.rectangle(bounds, { color: '#3388ff', weight: 2, fill: false }).addTo(map!);
			});
		}
	});

	// Crop overlay — replaces previous overlay when overlayUrl/overlayBounds change
	$effect(() => {
		if (!mapReady || !map || !overlayUrl || !overlayBounds) return;
		if (overlay) {
			overlay.remove();
		}
		import('leaflet').then((L) => {
			overlay = L.imageOverlay(overlayUrl, overlayBounds!, { crossOrigin: 'anonymous' }).addTo(
				map!
			);
			overlay.on('error', () => {
				errorMessage = 'Failed to load crop image — the data may not be available for this area';
			});
		});
	});

	function addWaypointMarker(
		L: typeof import('leaflet'),
		map: import('leaflet').Map,
		waypoint: Waypoint,
		id: number
	) {
		const leafletMarker = L.marker([waypoint.lat, waypoint.lon], {
			icon: L.divIcon({
				className: '',
				html: '<div style="width:12px;height:12px;background:#2563eb;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>',
				iconSize: [12, 12],
				iconAnchor: [6, 6]
			})
		}).addTo(map);

		const updatePopup = (name?: string) => {
			const nameVal = name ?? '';
			leafletMarker.bindPopup(`
				<div style="min-width:160px">
					<input id="wp-name-${id}" type="text" value="${nameVal.replace(/"/g, '&quot;')}"
						placeholder="Name this waypoint"
						style="width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;margin-bottom:6px" />
					<div style="display:flex;gap:6px">
						<button onclick="document.dispatchEvent(new CustomEvent('wp-save',{detail:{id:${id},name:document.getElementById('wp-name-${id}').value}}))"
							style="flex:1;padding:4px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px">Save</button>
						<button onclick="document.dispatchEvent(new CustomEvent('wp-delete',{detail:{id:${id}}}))"
							style="flex:1;padding:4px;background:#dc2626;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px">Delete</button>
					</div>
				</div>
			`);
		};

		updatePopup(waypoint.name);
		waypointMarkers.set(id, leafletMarker);

		const handleSave = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail.id !== id) return;
			const existing = waypointData.get(id);
			if (existing) {
				const updated = { ...existing, name: detail.name };
				waypointData.set(id, updated);
				waypoints = [...waypointData.values()];
				updatePopup(detail.name);
			}
			leafletMarker.closePopup();
		};

		const handleDelete = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail.id !== id) return;
			leafletMarker.remove();
			waypointMarkers.delete(id);
			waypointData.delete(id);
			waypoints = [...waypointData.values()];
			document.removeEventListener('wp-save', handleSave);
			document.removeEventListener('wp-delete', handleDelete);
		};

		document.addEventListener('wp-save', handleSave);
		document.addEventListener('wp-delete', handleDelete);
		cleanupFns.push(
			() => document.removeEventListener('wp-save', handleSave),
			() => document.removeEventListener('wp-delete', handleDelete)
		);
	}
</script>

<div class="relative h-full w-full">
	<div bind:this={mapContainer} class="h-full w-full"></div>
	<Legend />
	{#if loading}
		<div
			class="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-white/40"
		>
			<span class="rounded-lg bg-white px-4 py-2 text-sm font-semibold shadow"
				>Loading crop data…</span
			>
		</div>
	{/if}
	{#if errorMessage}
		<div class="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
			<span class="rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 shadow"
				>{errorMessage}</span
			>
		</div>
	{/if}
</div>
