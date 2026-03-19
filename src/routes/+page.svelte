<script lang="ts">
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MapView from '$lib/components/MapView.svelte';
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
</script>

<div class="flex h-screen w-screen overflow-hidden">
	<Sidebar bind:collapsed={sidebarCollapsed}>
		<p class="text-sm text-gray-500">Controls will go here.</p>
	</Sidebar>

	<main class="relative flex-1">
		<MapView bind:center={mapCenter} zoom={mapZoom} onMapClick={handleMapClick} />
	</main>
</div>
