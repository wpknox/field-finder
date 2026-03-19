<script lang="ts">
	let {
		onLocationSelect
	}: {
		onLocationSelect: (lat: number, lon: number, name?: string) => void;
	} = $props();

	let query = $state('');
	let results = $state<Array<{ display_name: string; lat: number; lon: number }>>([]);
	let showDropdown = $state(false);
	let error = $state('');
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	// Regex to detect lat/lon input: "40.554, -100.076" or "40.554 -100.076"
	const LATLON_REGEX = /^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/;

	function parseLatLon(input: string): { lat: number; lon: number } | null {
		const match = input.trim().match(LATLON_REGEX);
		if (!match) return null;
		const lat = parseFloat(match[1]);
		const lon = parseFloat(match[2]);
		if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
		return { lat, lon };
	}

	function handleInput() {
		error = '';
		const parsed = parseLatLon(query);
		if (parsed) {
			// Direct lat/lon — no need to geocode
			results = [];
			showDropdown = false;
			return;
		}

		// Debounce geocoding requests
		clearTimeout(debounceTimer);
		if (query.trim().length < 3) {
			results = [];
			showDropdown = false;
			return;
		}

		debounceTimer = setTimeout(async () => {
			try {
				const resp = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
				if (resp.ok) {
					results = await resp.json();
					showDropdown = results.length > 0;
					if (results.length === 0) {
						error = 'No results found';
					}
				}
			} catch {
				error = 'Geocoding failed';
			}
		}, 400);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			const parsed = parseLatLon(query);
			if (parsed) {
				onLocationSelect(parsed.lat, parsed.lon);
				showDropdown = false;
			} else if (results.length > 0) {
				selectResult(results[0]);
			}
		} else if (e.key === 'Escape') {
			showDropdown = false;
		}
	}

	function selectResult(result: { display_name: string; lat: number; lon: number }) {
		query = result.display_name;
		showDropdown = false;
		onLocationSelect(result.lat, result.lon, result.display_name);
	}
</script>

<div class="relative">
	<label for="search-input" class="mb-1 block text-sm font-semibold text-gray-700">Location</label>
	<input
		id="search-input"
		type="text"
		bind:value={query}
		oninput={handleInput}
		onkeydown={handleKeydown}
		onfocusout={() => setTimeout(() => (showDropdown = false), 200)}
		placeholder="Search address or lat, lon..."
		class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
	/>
	{#if error}
		<p class="mt-1 text-xs text-red-500">{error}</p>
	{/if}
	{#if showDropdown}
		<ul
			class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
		>
			{#each results as result (result.lat + ',' + result.lon)}
				<li>
					<button
						type="button"
						class="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
						onmousedown={() => selectResult(result)}
					>
						{result.display_name}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
