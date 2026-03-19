<script lang="ts">
	import { getAllCrops } from '$lib/crops';

	const crops = getAllCrops();
	let collapsed = $state(false);
</script>

<div class="absolute bottom-4 left-4 z-1000 rounded-lg bg-white/95 shadow-md">
	<button
		onclick={() => (collapsed = !collapsed)}
		class="flex w-full items-center justify-between gap-6 px-3 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900"
	>
		<span>Legend</span>
		<span class="text-gray-400">{collapsed ? '▲' : '▼'}</span>
	</button>
	{#if !collapsed}
		<div class="grid grid-cols-2 gap-x-4 gap-y-0.5 px-3 pb-2">
			{#each crops as crop (crop.key)}
				<div class="flex items-center gap-1.5 text-xs text-gray-600">
					<span class="inline-block h-2.5 w-2.5 rounded-sm" style="background-color: {crop.color}"
					></span>
					{crop.name}
				</div>
			{/each}
		</div>
	{/if}
</div>
