<!-- src/lib/components/YearSelector.svelte -->
<script lang="ts">
	import { CDL_MAX_YEAR, CDL_YEARS } from '$lib/constants';

	let { year = $bindable(CDL_MAX_YEAR) }: { year?: number } = $props();
</script>

<div>
	<label for="year-select" class="mb-1 block text-sm font-semibold text-gray-700">Year</label>
	<select
		id="year-select"
		bind:value={year}
		class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
	>
		{#each CDL_YEARS as y (y)}
			<option value={y}>{y}</option>
		{/each}
	</select>
</div>
