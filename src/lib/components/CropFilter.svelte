<!-- src/lib/components/CropFilter.svelte -->
<script lang="ts">
	import { getAllCrops, type CropKey } from '$lib/crops';

	let {
		selected = $bindable<Record<CropKey, boolean>>({} as Record<CropKey, boolean>)
	}: {
		selected?: Record<CropKey, boolean>;
	} = $props();

	const crops = getAllCrops();

	// Initialize all to true if not already set
	$effect(() => {
		for (const crop of crops) {
			if (selected[crop.key] === undefined) {
				selected[crop.key] = true;
			}
		}
	});
</script>

<fieldset>
	<legend class="mb-1 text-sm font-semibold text-gray-700">Crop Types</legend>
	<div class="flex flex-col gap-1">
		{#each crops as crop}
			<label class="flex items-center gap-2 text-sm text-gray-700">
				<input type="checkbox" bind:checked={selected[crop.key]} class="rounded" />
				<span
					class="inline-block h-3 w-3 rounded-sm"
					style="background-color: {crop.color}"
				></span>
				{crop.name}
			</label>
		{/each}
	</div>
</fieldset>
