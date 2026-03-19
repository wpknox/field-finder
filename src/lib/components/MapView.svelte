<script lang="ts">
	import { onMount } from 'svelte';
	import { computeBboxLatLon } from '$lib/geo';
	import Legend from './Legend.svelte';

	let {
		center = $bindable<[number, number]>([39.8, -98.5]),
		zoom = 5,
		radius = 10,
		overlayUrl = '',
		overlayBounds = undefined as [[number, number], [number, number]] | undefined,
		loading = false,
		errorMessage = '',
		onMapClick
	}: {
		center?: [number, number];
		zoom?: number;
		radius?: number;
		overlayUrl?: string;
		overlayBounds?: [[number, number], [number, number]];
		loading?: boolean;
		errorMessage?: string;
		onMapClick?: (lat: number, lon: number) => void;
	} = $props();

	let mapContainer: HTMLDivElement;
	let mapReady = $state(false);

	let map: import('leaflet').Map | undefined;
	let marker: import('leaflet').Marker | undefined;
	let bboxRect: import('leaflet').Rectangle | undefined;
	let overlay: import('leaflet').ImageOverlay | undefined;

	onMount(() => {
		import('leaflet').then((L) => {
			map = L.map(mapContainer).setView(center, zoom);

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map);

			map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
				onMapClick?.(e.latlng.lat, e.latlng.lng);
			});

			mapReady = true;
		});

		return () => {
			map?.remove();
		};
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
		});
	});
</script>

<div class="relative h-full w-full">
	<div bind:this={mapContainer} class="h-full w-full"></div>
	<Legend />
	{#if loading}
		<div
			class="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-white/40"
		>
			<span class="rounded-lg bg-white px-4 py-2 text-sm font-semibold shadow">Loading crop data…</span>
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
