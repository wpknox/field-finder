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
	import { CROPS, type CropKey } from '$lib/crops';
	import {
		getSidebarCollapsed, saveSidebarCollapsed,
		getLastLocation, saveLastLocation,
		getLastRadius, saveLastRadius,
		getCropFilters, saveCropFilters,
		getWaypoints, saveWaypoints,
		type Waypoint
	} from '$lib/localStorage';

	let sidebarCollapsed = $state(false);
	let mapCenter = $state<[number, number]>([39.8, -98.5]);
	let mapZoom = $state(5);
	let radius = $state(10);
	let year = $state(2024);
	let cropFilters = $state<Record<CropKey, boolean>>({} as Record<CropKey, boolean>);
	let loading = $state(false);
	let overlayUrl = $state('');
	let overlayBounds = $state<[[number, number], [number, number]] | undefined>(undefined);
	let errorMessage = $state('');
	let hasLocation = $state(false);
	let waypoints = $state<Waypoint[]>([]);

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
	});

	// Persist state changes to localStorage
	$effect(() => { saveSidebarCollapsed(sidebarCollapsed, localStorage); });
	$effect(() => { saveLastRadius(radius, localStorage); });
	$effect(() => { saveCropFilters(cropFilters, localStorage); });
	$effect(() => { saveWaypoints(waypoints, localStorage); });

	function handleLocationSelect(lat: number, lon: number, _name?: string) {
		mapCenter = [lat, lon];
		mapZoom = 12;
		hasLocation = true;
		saveLastLocation({ lat, lon }, localStorage);
	}

	function handleMapClick(lat: number, lon: number) {
		mapCenter = [lat, lon];
		hasLocation = true;
		saveLastLocation({ lat, lon }, localStorage);
	}

	async function handleSearch() {
		if (!hasLocation) return;

		loading = true;
		errorMessage = '';

		// Collect selected crop IDs
		const selectedCropIds = Object.entries(cropFilters)
			.filter(([, checked]) => checked)
			.map(([key]) => CROPS[key as CropKey].id);

		try {
			const resp = await fetch('/api/search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					lat: mapCenter[0],
					lon: mapCenter[1],
					radius,
					year,
					crops: selectedCropIds
				})
			});

			if (!resp.ok) {
				const err = await resp.json().catch(() => ({ message: 'Unknown error' }));
				errorMessage = err.message || "Couldn't fetch crop data — try again";
				return;
			}

			const data = await resp.json();
			if (!data.pngUrl) {
				errorMessage = `No crop data available for this area in ${year}`;
				return;
			}
			overlayUrl = data.pngUrl;
			overlayBounds = data.bounds;
		} catch {
			errorMessage = "Couldn't fetch crop data — try again";
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar bind:collapsed={sidebarCollapsed}>
		<SearchBar onLocationSelect={handleLocationSelect} />
		<RadiusSlider bind:radius />
		<YearSelector bind:year />
		<CropFilter bind:selected={cropFilters} />
		<SearchButton onclick={handleSearch} {loading} disabled={!hasLocation} />
	</Sidebar>

	<main class="relative flex-1">
		<MapView
			bind:center={mapCenter}
			zoom={mapZoom}
			{radius}
			{overlayUrl}
			{overlayBounds}
			{loading}
			{errorMessage}
			bind:waypoints
			onMapClick={handleMapClick}
		/>
	</main>
</div>
