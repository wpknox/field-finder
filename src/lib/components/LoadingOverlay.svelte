<script lang="ts">
	let { message }: { message: string } = $props();

	let dotCount = $state(1);
	let interval: ReturnType<typeof setInterval> | undefined;

	$effect(() => {
		if (!message) return;
		dotCount = 1;
		interval = setInterval(() => {
			dotCount = (dotCount % 3) + 1;
		}, 500);
		return () => clearInterval(interval);
	});

	let dots = $derived('.'.repeat(dotCount));
</script>

{#if message}
	<div
		class="pointer-events-none absolute inset-0 z-1000 flex items-center justify-center bg-white/40"
	>
		<div class="flex items-center gap-3 rounded-lg bg-white px-5 py-3 text-sm font-semibold shadow-lg">
			<!-- Spinner -->
			<svg
				class="h-4 w-4 animate-spin text-green-700"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
				/>
			</svg>
			<!-- Message with oscillating dots -->
			<span class="text-gray-800">{message}<span class="inline-block w-5 text-left">{dots}</span></span>
		</div>
	</div>
{/if}
