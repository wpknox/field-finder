<!-- src/lib/components/AreaSummary.svelte -->
<script lang="ts">
	import type { CropStat } from '$lib/cropStats';

	let { stats = [] }: { stats?: CropStat[] } = $props();
</script>

{#if stats.length > 0}
	<div>
		<h3 class="mb-2 text-sm font-semibold text-gray-700">Area Summary</h3>
		<ul class="space-y-1 text-sm">
			{#each stats as stat (stat.id)}
				<li class="flex items-center gap-2">
					<span
						class="inline-block h-3 w-3 shrink-0 rounded-sm"
						style="background-color: {stat.color}"
					></span>
					<span class="flex-1 truncate">{stat.name}</span>
					<span class="font-mono text-gray-600">{stat.percentage.toFixed(1)}%</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}
