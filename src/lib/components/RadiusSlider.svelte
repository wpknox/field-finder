<!-- src/lib/components/RadiusSlider.svelte -->
<script lang="ts">
	let { radius = $bindable(10) }: { radius?: number } = $props();
</script>

<div>
	<label for="radius-slider" class="mb-1 block text-sm font-semibold text-gray-700">
		Radius: {radius}
		{radius === 1 ? 'mile' : 'miles'}
	</label>
	<input id="radius-slider" type="range" min="1" max="50" bind:value={radius} class="w-full" />
	{#if radius > 15}
		<p class="mt-1 text-xs text-amber-600">Larger areas may take longer to load</p>
	{/if}
</div>
