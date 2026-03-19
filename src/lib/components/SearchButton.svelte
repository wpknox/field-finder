<!-- src/lib/components/SearchButton.svelte -->
<script lang="ts">
	let {
		loading = false,
		disabled = false,
		onclick
	}: {
		loading?: boolean;
		disabled?: boolean;
		onclick: () => void;
	} = $props();
</script>

<button
	type="button"
	{onclick}
	disabled={disabled || loading}
	class="w-full rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
>
	{#if loading}
		Searching...
	{:else}
		Search
	{/if}
</button>
