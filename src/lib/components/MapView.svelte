<script lang="ts">
	import { onMount } from 'svelte';
	import { computeBboxLatLon } from '$lib/geo';
	import Legend from './Legend.svelte';
	import ErrorToast from './ErrorToast.svelte';
	import type { Waypoint } from '$lib/localStorage';

	let {
		center = $bindable<[number, number]>([39.8, -98.5]),
		zoom = 5,
		radius = 10,
		overlayUrl = '',
		overlayBounds = undefined as [[number, number], [number, number]] | undefined,
		loadingMessage = '',
		panVersion = 0,
		errorMessage = $bindable(''),
		waypoints = $bindable<Waypoint[]>([]),
		onMapClick
	}: {
		center?: [number, number];
		zoom?: number;
		radius?: number;
		overlayUrl?: string;
		overlayBounds?: [[number, number], [number, number]];
		loadingMessage?: string;
		panVersion?: number;
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

	// Internal Leaflet tracking maps — intentionally plain Map, not SvelteMap.
	// The UI reads from the `waypoints` $state array; these maps are only used
	// for marker/data lookup and cleanup. Making them reactive would add overhead
	// and risk triggering unintended $effect re-runs.
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
				const wpMarker = addWaypointMarker(L, map!, waypoint, id);
				wpMarker.openPopup();
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

	// Location marker — updates when center changes; draggable so user can nudge it
	$effect(() => {
		if (!mapReady || !map) return;
		const [lat, lon] = center;
		if (marker) {
			marker.setLatLng([lat, lon]);
		} else {
			import('leaflet').then((L) => {
				marker = L.marker([lat, lon], { draggable: true }).addTo(map!);
				// Live bbox update during drag — directly manipulates bboxRect without
				// touching `center` state to avoid calling setLatLng mid-drag.
				marker.on('drag', () => {
					const { lat: newLat, lng: newLon } = marker!.getLatLng();
					if (bboxRect) {
						const bbox = computeBboxLatLon(newLat, newLon, radius);
						bboxRect.setBounds([
							[bbox.south, bbox.west],
							[bbox.north, bbox.east]
						]);
					}
				});
				marker.on('dragend', () => {
					const { lat: newLat, lng: newLon } = marker!.getLatLng();
					center = [newLat, newLon];
					onMapClick?.(newLat, newLon);
				});
			});
		}
	});

	// Pan map when the parent signals a new location was selected (address search / lat-lon input).
	// panVersion is only incremented by handleLocationSelect, not by map clicks or marker drag,
	// so this won't fight with interactions where the map is already at the right position.
	$effect(() => {
		if (!mapReady || !map || panVersion === 0) return;
		const [lat, lon] = center;
		map.panTo([lat, lon]);
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
			overlay = L.imageOverlay(overlayUrl, overlayBounds!).addTo(
				map!
			);
			overlay.on('error', () => {
				errorMessage = 'Failed to load crop image — the data may not be available for this area';
			});
		});
	});

	/** Returns the HTML string for a waypoint dot marker icon. */
	function waypointIconHtml(): string {
		return '<div style="width:12px;height:12px;background:#2563eb;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>';
	}

	/**
	 * Returns the HTML string for a waypoint popup.
	 *
	 * Note: Leaflet popups are rendered outside Svelte's component tree, so a plain
	 * HTML string is the only way to inject content. Save/delete actions are bridged
	 * back into Svelte via CustomEvents dispatched on `document`.
	 */
	function waypointPopupHtml(id: number, name: string): string {
		const escapedName = name.replace(/"/g, '&quot;');
		return `
			<div style="min-width:160px">
				<input id="wp-name-${id}" type="text" value="${escapedName}"
					placeholder="Name this waypoint"
					style="width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;margin-bottom:6px" />
				<div style="display:flex;gap:6px">
					<button onclick="document.dispatchEvent(new CustomEvent('wp-save',{detail:{id:${id},name:document.getElementById('wp-name-${id}').value}}))"
						style="flex:1;padding:4px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px">Save</button>
					<button onclick="document.dispatchEvent(new CustomEvent('wp-delete',{detail:{id:${id}}}))"
						style="flex:1;padding:4px;background:#dc2626;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px">Delete</button>
				</div>
			</div>
		`;
	}

	function addWaypointMarker(
		L: typeof import('leaflet'),
		map: import('leaflet').Map,
		waypoint: Waypoint,
		id: number
	): import('leaflet').Marker {
		const leafletMarker = L.marker([waypoint.lat, waypoint.lon], {
			icon: L.divIcon({
				className: '',
				html: waypointIconHtml(),
				iconSize: [12, 12],
				iconAnchor: [6, 6]
			})
		}).addTo(map);

		const updatePopup = (name?: string) => {
			leafletMarker.bindPopup(waypointPopupHtml(id, name ?? ''));
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

		return leafletMarker;
	}
</script>

<div class="relative h-full w-full">
	<div bind:this={mapContainer} class="h-full w-full"></div>
	<!-- Legend + map hint sit together at the bottom-left -->
	<div class="absolute bottom-4 left-4 z-1000 flex items-end gap-3">
		<Legend />
		<p class="pointer-events-none mb-1 text-xs text-gray-400">
			Right-click to add a waypoint &nbsp;·&nbsp; Drag the marker to reposition
		</p>
	</div>
	{#if loadingMessage}
		<div
			class="pointer-events-none absolute inset-0 z-1000 flex items-center justify-center bg-white/40"
		>
			<span class="rounded-lg bg-white px-4 py-2 text-sm font-semibold shadow"
				>{loadingMessage}</span
			>
		</div>
	{/if}
	<ErrorToast message={errorMessage} ondismiss={() => (errorMessage = '')} />
</div>
