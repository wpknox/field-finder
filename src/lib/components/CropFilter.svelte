<!-- src/lib/components/CropFilter.svelte -->
<script lang="ts">
	import { getAllCrops, resolveCropColors, type CropColors, type CropKey } from '$lib/crops';

	// `colors` defaults to the hardcoded CROPS colors so the swatches are correct
	// on first paint; the page overrides it from the live raster palette.
	let {
		selected = $bindable<Record<CropKey, boolean>>({} as Record<CropKey, boolean>),
		colors = resolveCropColors()
	}: {
		selected?: Record<CropKey, boolean>;
		colors?: CropColors;
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
	<div class="mb-1 flex items-center justify-between">
		<legend class="text-sm font-semibold text-gray-700">Crop Types</legend>
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => crops.forEach((c) => (selected[c.key] = true))}
				class="text-xs text-blue-600 hover:underline"
			>
				Select All
			</button>
			<span class="text-xs text-gray-300">|</span>
			<button
				type="button"
				onclick={() => crops.forEach((c) => (selected[c.key] = false))}
				class="text-xs text-blue-600 hover:underline"
			>
				Clear All
			</button>
		</div>
	</div>
	<div class="flex flex-col gap-1">
		{#each crops as crop (crop.key)}
			<label class="flex items-center gap-2 text-sm text-gray-700">
				<input type="checkbox" bind:checked={selected[crop.key]} class="rounded" />
				<span class="inline-block h-3 w-3 rounded-sm" style="background-color: {colors[crop.key]}"
				></span>
				{crop.name}
			</label>
		{/each}
	</div>
	{#if noneSelected}
		<p class="mt-2 text-xs text-amber-600">No crops selected — all crop data will be shown.</p>
	{/if}
</fieldset>
