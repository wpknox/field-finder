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
		type Waypoint
	} from '$lib/localStorage';

	let sidebarCollapsed = $state(false);
	let mapCenter = $state<[number, number]>([39.8, -98.5]);
	let mapZoom = $state(5);
	let radius = $state(10);
	let year = $state(2024);
	let cropFilters = $state<Record<CropKey, boolean>>({} as Record<CropKey, boolean>);
	let loadingMessage = $state('');
	let loading = $derived(loadingMessage !== '');
	let overlayUrl = $state('');
	let overlayBounds = $state<[[number, number], [number, number]] | undefined>(undefined);
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

			if (!resp.ok || !resp.body) {
				errorMessage = "Couldn't fetch crop data — try again";
				return;
			}

			const reader = resp.body.getReader();
			const decoder = new TextDecoder();

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				// SSE lines: "data: {...}\n\n"
				for (const line of decoder.decode(value).split('\n')) {
					if (!line.startsWith('data: ')) continue;
					const event = JSON.parse(line.slice(6));

					if (event.type === 'progress') {
						loadingMessage = event.message;
					} else if (event.type === 'done') {
						overlayUrl = event.pngUrl;
						overlayBounds = event.bounds;
					} else if (event.type === 'error') {
						errorMessage = event.message || "Couldn't fetch crop data — try again";
					}
				}
			}
		} catch {
			errorMessage = "Couldn't fetch crop data — try again";
		} finally {
			loadingMessage = '';
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
			{loadingMessage}
			{panVersion}
			bind:errorMessage
			bind:waypoints
			onMapClick={handleMapClick}
		/>
	</main>
</div>
