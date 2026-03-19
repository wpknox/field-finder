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

	const noneSelected = $derived(crops.every((c) => !selected[c.key]));
</script>

<fieldset>
	<legend class="mb-1 text-sm font-semibold text-gray-700">Crop Types</legend>
	<div class="flex flex-col gap-1">
		{#each crops as crop (crop.key)}
			<label class="flex items-center gap-2 text-sm text-gray-700">
				<input type="checkbox" bind:checked={selected[crop.key]} class="rounded" />
				<span class="inline-block h-3 w-3 rounded-sm" style="background-color: {crop.color}"></span>
				{crop.name}
			</label>
		{/each}
	</div>
	{#if noneSelected}
		<p class="mt-2 text-xs text-amber-600">No crops selected — all crop data will be shown.</p>
	{/if}
</fieldset>
