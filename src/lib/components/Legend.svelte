<script lang="ts">
	import { getAllCrops } from '$lib/crops';

	const crops = getAllCrops();
</script>

<div class="absolute bottom-4 left-4 z-[1000] rounded-lg bg-white/95 px-3 py-2 shadow-md">
	<h3 class="mb-1 text-xs font-semibold text-gray-700">Legend</h3>
	<div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
		{#each crops as crop}
			<div class="flex items-center gap-1.5 text-xs text-gray-600">
				<span class="inline-block h-2.5 w-2.5 rounded-sm" style="background-color: {crop.color}"></span>
				{crop.name}
			</div>
		{/each}
	</div>
</div>
