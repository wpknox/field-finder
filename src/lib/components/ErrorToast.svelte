<script lang="ts">
	let {
		message,
		ondismiss
	}: {
		message: string;
		ondismiss: () => void;
	} = $props();

	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!message) return;
		clearTimeout(timer);
		timer = setTimeout(() => ondismiss(), 5000);
		return () => clearTimeout(timer);
	});
</script>

{#if message}
	<div class="pointer-events-none absolute inset-0 z-1000 flex items-center justify-center">
		<div
			class="pointer-events-auto flex items-start gap-3 rounded-lg bg-red-100 px-4 py-3 text-sm font-semibold text-red-700 shadow-lg"
		>
			<span class="leading-snug">{message}</span>
			<button
				onclick={ondismiss}
				class="mt-0.5 shrink-0 text-base leading-none text-red-500 hover:text-red-800"
				aria-label="Dismiss"
			>✕</button>
		</div>
	</div>
{/if}
