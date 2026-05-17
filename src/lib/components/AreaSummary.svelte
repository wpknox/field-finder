<!-- src/lib/components/AreaSummary.svelte -->
<script lang="ts">
	import type { CropStat } from '$lib/cropStats';

	let { stats = [] }: { stats?: CropStat[] } = $props();
	let open = $state(true);
</script>

{#if stats.length > 0}
	<div class="border-t border-gray-200 pt-3">
		<button
			onclick={() => (open = !open)}
			class="flex w-full items-center justify-between text-sm font-semibold text-gray-700 hover:text-gray-900"
		>
			<span>Area Summary</span>
			<span class="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
		</button>
		<div
			class="grid transition-all duration-200 ease-in-out"
			style="grid-template-rows: {open ? '1fr' : '0fr'}"
		>
			<ul class="space-y-1 overflow-hidden pt-2 text-sm">
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
	</div>
{/if}
