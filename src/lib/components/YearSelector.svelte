<!-- src/lib/components/YearSelector.svelte -->
<script lang="ts">
	let { year = $bindable(2024) }: { year?: number } = $props();

	// CDL data available from 1997-2024
	const years = Array.from({ length: 2024 - 1997 + 1 }, (_, i) => 2024 - i);
</script>

<div>
	<label for="year-select" class="mb-1 block text-sm font-semibold text-gray-700">Year</label>
	<select
		id="year-select"
		bind:value={year}
		class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
	>
		{#each years as y (y)}
			<option value={y}>{y}</option>
		{/each}
	</select>
</div>
