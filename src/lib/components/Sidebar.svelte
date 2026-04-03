<script lang="ts">
	let { collapsed = $bindable(false), children } = $props();
</script>

<!--
	Width transitions between 2.5rem (collapsed) and 20rem (expanded).
	overflow-hidden clips the aside during the animation.
	The aside content is made invisible immediately on collapse so clipped
	text/checkboxes don't show through during the width slide.
-->
<div
	class="relative h-full shrink-0 overflow-hidden border-r border-gray-200 bg-gray-50 transition-[width] duration-300 ease-in-out"
	style="width: {collapsed ? '2.5rem' : '20rem'}"
>
	<!-- Full sidebar content — invisible when collapsed so clipping looks clean -->
	<aside
		class="flex h-full w-80 flex-col"
		class:invisible={collapsed}
		aria-hidden={collapsed}
	>
		<div class="flex items-center justify-between bg-green-800 px-4 py-3">
			<h1 class="text-lg font-bold tracking-wide text-white">Field Finder</h1>
			<button
				onclick={() => (collapsed = true)}
				class="rounded border border-green-600 px-2 py-0.5 text-sm text-green-200 hover:border-green-400 hover:text-white"
				aria-label="Collapse sidebar"
			>
				◀ Hide
			</button>
		</div>
		<div class="flex flex-col gap-4 overflow-y-auto px-4 py-4">
			{@render children()}
		</div>
	</aside>

	<!-- Expand button — solid background so nothing bleeds through -->
	<button
		onclick={() => (collapsed = false)}
		class="absolute inset-y-0 left-0 flex w-10 items-start justify-center bg-green-800 pt-3 text-green-200 hover:text-white"
		style="opacity: {collapsed ? 1 : 0}; pointer-events: {collapsed ? 'auto' : 'none'}"
		aria-label="Expand sidebar"
		tabindex={collapsed ? 0 : -1}
	>
		<span class="rounded border border-green-600 px-1 hover:border-green-400">▶</span>
	</button>
</div>
