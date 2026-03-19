<script lang="ts">
	import { onMount } from 'svelte';

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

	onMount(() => {
		let map: import('leaflet').Map | undefined;

		import('leaflet').then((L) => {
			map = L.map(mapContainer).setView(center, zoom);

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map);

			map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
				onMapClick?.(e.latlng.lat, e.latlng.lng);
			});
		});

		return () => {
			map?.remove();
		};
	});
</script>

<div bind:this={mapContainer} class="h-full w-full"></div>
