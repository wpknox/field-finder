<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import RadiusSlider from '$lib/components/RadiusSlider.svelte';
	import YearSelector from '$lib/components/YearSelector.svelte';
	import CropFilter from '$lib/components/CropFilter.svelte';
	import SearchButton from '$lib/components/SearchButton.svelte';
	import OpacitySlider from '$lib/components/OpacitySlider.svelte';
	import AreaSummary from '$lib/components/AreaSummary.svelte';
	import type { CropStat } from '$lib/cropStats';
	import type { SearchResult } from '$lib/searchResult';
	import { CROPS, resolveCropColors, type CdlPalette, type CropKey } from '$lib/crops';
	import { CDL_MAX_YEAR } from '$lib/constants';
	import {
		getSidebarCollapsed,
		saveSidebarCollapsed,
		getLastLocation,
		saveLastLocation,
		getLastRadius,
		saveLastRadius,
		getCropFilters,
		saveCropFilters,
		getWaypoints,
		saveWaypoints,
		getOverlayOpacity,
		saveOverlayOpacity,
		type Waypoint
	} from '$lib/localStorage';

	let sidebarCollapsed = $state(false);
	let mapCenter = $state<[number, number]>([39.8, -98.5]);
	let mapZoom = $state(5);
	let radius = $state(10);
	let year = $state(CDL_MAX_YEAR);
	let cropFilters = $state<Record<CropKey, boolean>>({} as Record<CropKey, boolean>);
	let loadingMessage = $state('');
	let loading = $derived(loadingMessage !== '');
	let searchResult = $state<SearchResult | null>(null);
	let overlayOpacity = $state(0.7);
	let cropStats = $state<CropStat[]>([]);
	// Colormap of the currently rendered raster, lifted out of MapView so the
	// sidebar swatches match what the overlay actually paints. Null until the
	// first raster is parsed, in which case the hardcoded colors are used.
	let cropPalette = $state<CdlPalette | null>(null);
	let cropColors = $derived(resolveCropColors(cropPalette));
	let errorMessage = $state('');
	let hasLocation = $state(false);
	let searchQuery = $state('');
	let waypoints = $state<Waypoint[]>([]);
	let panVersion = $state(0);

	onMount(() => {
		const savedCollapsed = getSidebarCollapsed(localStorage);
		if (savedCollapsed !== null) sidebarCollapsed = savedCollapsed;

		const savedLocation = getLastLocation(localStorage);
		if (savedLocation) {
			mapCenter = [savedLocation.lat, savedLocation.lon];
			mapZoom = 12;
			hasLocation = true;
		}

		const savedRadius = getLastRadius(localStorage);
		if (savedRadius !== null) radius = savedRadius;

		const savedFilters = getCropFilters(localStorage);
		if (savedFilters) cropFilters = savedFilters as Record<CropKey, boolean>;

		const savedWaypoints = getWaypoints(localStorage);
		if (savedWaypoints.length > 0) waypoints = savedWaypoints;

		const savedOpacity = getOverlayOpacity(localStorage);
		if (savedOpacity !== null) overlayOpacity = savedOpacity;
	});

	// Persist state changes to localStorage
	$effect(() => {
		saveSidebarCollapsed(sidebarCollapsed, localStorage);
	});
	$effect(() => {
		saveLastRadius(radius, localStorage);
	});
	$effect(() => {
		saveCropFilters(cropFilters, localStorage);
	});
	$effect(() => {
		saveWaypoints(waypoints, localStorage);
	});
	$effect(() => {
		saveOverlayOpacity(overlayOpacity, localStorage);
	});

	function handleLocationSelect(lat: number, lon: number) {
		mapCenter = [lat, lon];
		mapZoom = 12;
		hasLocation = true;
		panVersion++;
		saveLastLocation({ lat, lon }, localStorage);
	}

	function handleMapClick(lat: number, lon: number) {
		mapCenter = [lat, lon];
		hasLocation = true;
		searchQuery = '';
		saveLastLocation({ lat, lon }, localStorage);
	}

	async function handleSearch() {
		if (!hasLocation) return;

		loadingMessage = 'Starting...';
		errorMessage = '';
		let handedOffToMap = false;

		// Snapshot the search parameters up front — the user is free to move the
		// marker or the radius slider while the multi-second fetch is in flight,
		// and the overlay must be placed where the search actually happened.
		const searchLat = mapCenter[0];
		const searchLon = mapCenter[1];
		const searchRadius = radius;

		try {
			const selectedCropIds = Object.entries(cropFilters)
				.filter(([, checked]) => checked)
				.map(([key]) => CROPS[key as CropKey].id);

			const resp = await fetch('/api/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					lat: searchLat,
					lon: searchLon,
					radius: searchRadius,
					year,
					crops: selectedCropIds
				})
			});

			if (!resp.ok || !resp.body) {
				errorMessage = "Couldn't fetch crop data — try again";
				return;
			}

			const reader = resp.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop()!; // hold incomplete trailing line for next chunk

				for (const line of lines) {
					if (!line.startsWith('data: ')) continue;
					const event = JSON.parse(line.slice(6));

					if (event.type === 'progress') {
						loadingMessage = event.message;
					} else if (event.type === 'done') {
						searchResult = {
							tifBase64: event.tifBase64,
							lat: searchLat,
							lon: searchLon,
							radius: searchRadius
						};
						handedOffToMap = true;
					} else if (event.type === 'error') {
						errorMessage = event.message || "Couldn't fetch crop data — try again";
					}
				}
			}
		} catch {
			errorMessage = "Couldn't fetch crop data — try again";
		} finally {
			if (!handedOffToMap) {
				loadingMessage = '';
			}
			// If handedOffToMap is true, MapView manages loadingMessage
			// from here — it will clear it when GeoTIFF rendering finishes
		}
	}
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar bind:collapsed={sidebarCollapsed}>
		<SearchBar
			bind:query={searchQuery}
			center={hasLocation ? mapCenter : undefined}
			onLocationSelect={handleLocationSelect}
		/>
		<RadiusSlider bind:radius />
		<YearSelector bind:year />
		<CropFilter bind:selected={cropFilters} colors={cropColors} />
		<OpacitySlider bind:opacity={overlayOpacity} />
		<SearchButton onclick={handleSearch} {loading} disabled={!hasLocation} />
		<AreaSummary stats={cropStats} />
	</Sidebar>

	<main class="relative flex-1">
		<MapView
			bind:center={mapCenter}
			zoom={mapZoom}
			{radius}
			{searchResult}
			{overlayOpacity}
			bind:loadingMessage
			{panVersion}
			bind:errorMessage
			bind:waypoints
			bind:cropStats
			bind:cropPalette
			onMapClick={handleMapClick}
		/>
	</main>
</div>
