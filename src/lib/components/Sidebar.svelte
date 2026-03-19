<script lang="ts">
	let { collapsed = $bindable(false), children } = $props();
</script>

{#if !collapsed}
	<aside
		class="flex h-full w-80 flex-shrink-0 flex-col gap-4 overflow-y-auto border-r border-gray-200 bg-gray-50 p-4"
	>
		<div class="flex items-center justify-between">
			<h1 class="text-xl font-bold text-gray-800">Field Finder</h1>
			<button
				onclick={() => (collapsed = true)}
				class="text-sm text-gray-500 hover:text-gray-700"
				aria-label="Collapse sidebar"
			>
				◀ Hide
			</button>
		</div>
		{@render children()}
	</aside>
{:else}
	<button
		onclick={() => (collapsed = false)}
		class="flex h-full w-10 flex-shrink-0 items-start justify-center border-r border-gray-200 bg-gray-50 pt-4 text-gray-500 hover:text-gray-700"
		aria-label="Expand sidebar"
	>
		▶
	</button>
{/if}
