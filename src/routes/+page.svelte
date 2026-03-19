<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import { getSidebarCollapsed, saveSidebarCollapsed } from '$lib/localStorage';
	import { onMount } from 'svelte';

	let sidebarCollapsed = $state(false);
	let mapCenter = $state<[number, number]>([39.8, -98.5]);
	let mapZoom = $state(5);

	onMount(() => {
		const saved = getSidebarCollapsed(localStorage);
		if (saved !== null) sidebarCollapsed = saved;
	});

	$effect(() => {
		if (typeof window !== 'undefined') {
			saveSidebarCollapsed(sidebarCollapsed, localStorage);
		}
	});

	function handleMapClick(lat: number, lon: number) {
		// Will be wired up to set location marker in later tasks
		console.log('Map clicked:', lat, lon);
	}

	function handleLocationSelect(lat: number, lon: number, name?: string) {
		mapCenter = [lat, lon];
		mapZoom = 12;
		// Will set location marker in MapView task
	}
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar bind:collapsed={sidebarCollapsed}>
		<SearchBar onLocationSelect={handleLocationSelect} />
	</Sidebar>

	<main class="relative flex-1">
		<MapView bind:center={mapCenter} zoom={mapZoom} onMapClick={handleMapClick} />
	</main>
</div>
