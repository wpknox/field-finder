<!-- src/lib/components/OpacitySlider.svelte -->
<script lang="ts">
	let { opacity = $bindable(0.7) }: { opacity?: number } = $props();
</script>

<div>
	<label for="opacity-slider" class="mb-1 block text-sm font-semibold text-gray-700">
		Overlay Opacity: {Math.round(opacity * 100)}%
	</label>
	<input
		id="opacity-slider"
		type="range"
		min="0"
		max="100"
		value={Math.round(opacity * 100)}
		oninput={(e) => (opacity = parseInt(e.currentTarget.value) / 100)}
		class="w-full"
	/>
</div>
