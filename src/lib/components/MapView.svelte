<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { computeBboxLatLon } from '$lib/geo';
	import Legend from './Legend.svelte';
	import ErrorToast from './ErrorToast.svelte';
	import LoadingOverlay from './LoadingOverlay.svelte';
	import type { Waypoint } from '$lib/localStorage';
	import { computeCropStats, type CropStat } from '$lib/cropStats';
	import { resolveCropColors, type CdlPalette } from '$lib/crops';
	import { rasterToDataUrl } from '$lib/renderGeoraster';
	import type { SearchResult } from '$lib/searchResult';
	import { startOverlayRun } from '$lib/overlayRun';
	import { isTiff, withTimeout, RASTER_PARSE_TIMEOUT_MS } from '$lib/rasterGuards';

	// Two sources of center/radius live here, and they are NOT interchangeable:
	//   • live `center` / `radius` — drive the marker and the bbox preview rectangle,
	//     and must track the user's drags in real time.
	//   • `searchResult.{lat,lon,radius}` — the frozen bbox the raster was actually
	//     fetched for, and the only thing the overlay may be placed with.
	// Never mix them: using the live values for the overlay is exactly audit B2.
	let {
		center = $bindable<[number, number]>([39.8, -98.5]),
		zoom = 5,
		radius = 10,
		searchResult = null,
		overlayOpacity = 0.7,
		loadingMessage = '',
		panVersion = 0,
		errorMessage = $bindable(''),
		waypoints = $bindable<Waypoint[]>([]),
		cropStats = $bindable<CropStat[]>([]),
		cropPalette = $bindable<CdlPalette | null>(null),
		onMapClick,
		onRenderComplete,
		onRenderError
	}: {
		center?: [number, number];
		zoom?: number;
		radius?: number;
		searchResult?: SearchResult | null;
		overlayOpacity?: number;
		loadingMessage?: string;
		panVersion?: number;
		errorMessage?: string;
		waypoints?: Waypoint[];
		cropStats?: CropStat[];
		cropPalette?: CdlPalette | null;
		onMapClick?: (lat: number, lon: number) => void;
		/** A search result finished rendering and its overlay is on the map. */
		onRenderComplete?: (result: SearchResult) => void;
		/** A search result could not be rendered. */
		onRenderError?: (result: SearchResult) => void;
	} = $props();

	// Colors the overlay is actually painted with — falls back to the hardcoded
	// CROPS colors until a raster has been parsed.
	const cropColors = $derived(resolveCropColors(cropPalette));

	let mapContainer: HTMLDivElement;
	let mapReady = $state(false);

	let map: import('leaflet').Map | undefined;
	let marker: import('leaflet').Marker | undefined;
	let bboxRect: import('leaflet').Rectangle | undefined;
	let overlay = $state<import('leaflet').ImageOverlay | undefined>(undefined);

	// Internal Leaflet tracking maps — intentionally plain Map, not SvelteMap.
	// The UI reads from the `waypoints` $state array; these maps are only used
	// for marker/data lookup and cleanup. Making them reactive would add overhead
	// and risk triggering unintended $effect re-runs.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const waypointMarkers = new Map<number, import('leaflet').Marker>();
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const waypointData = new Map<number, Waypoint>(); // id → waypoint
	let waypointIdCounter = 0;
	const cleanupFns: Array<() => void> = [];
	let restoredFromStorage = false;

	onMount(() => {
		import('leaflet').then((L) => {
			map = L.map(mapContainer).setView(center, zoom);

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map);

			map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
				onMapClick?.(e.latlng.lat, e.latlng.lng);
			});

			map.on('contextmenu', (e: import('leaflet').LeafletMouseEvent) => {
				const id = waypointIdCounter++;
				const waypoint: Waypoint = { lat: e.latlng.lat, lon: e.latlng.lng };
				waypointData.set(id, waypoint);
				waypoints = [...waypointData.values()];
				const wpMarker = addWaypointMarker(L, map!, waypoint, id);
				wpMarker.openPopup();
			});

			mapReady = true;
		});

		return () => {
			cleanupFns.forEach((fn) => fn());
			map?.remove();
		};
	});

	// Sync markers with waypoints from localStorage on load
	$effect(() => {
		if (!mapReady || restoredFromStorage) return;
		restoredFromStorage = true;
		import('leaflet').then((L) => {
			waypoints.forEach((wp) => {
				const id = waypointIdCounter++;
				waypointData.set(id, wp);
				addWaypointMarker(L, map!, wp, id);
			});
		});
	});

	// Location marker — updates when center changes; draggable so user can nudge it
	$effect(() => {
		if (!mapReady || !map) return;
		const [lat, lon] = center;
		if (marker) {
			marker.setLatLng([lat, lon]);
		} else {
			import('leaflet').then((L) => {
				marker = L.marker([lat, lon], { draggable: true }).addTo(map!);
				// Live bbox update during drag — directly manipulates bboxRect without
				// touching `center` state to avoid calling setLatLng mid-drag.
				marker.on('drag', () => {
					const { lat: newLat, lng: newLon } = marker!.getLatLng();
					if (bboxRect) {
						const bbox = computeBboxLatLon(newLat, newLon, radius);
						bboxRect.setBounds([
							[bbox.south, bbox.west],
							[bbox.north, bbox.east]
						]);
					}
				});
				marker.on('dragend', () => {
					const { lat: newLat, lng: newLon } = marker!.getLatLng();
					center = [newLat, newLon];
					onMapClick?.(newLat, newLon);
				});
			});
		}
	});

	// Pan map when the parent signals a new location was selected (address search / lat-lon input).
	// panVersion is only incremented by handleLocationSelect, not by map clicks or marker drag.
	// center is read untracked so that panVersion is the effect's ONLY reactive dependency —
	// otherwise a click or drag (which changes center) would re-pan the map. See audit B1.
	$effect(() => {
		if (!mapReady || !map || panVersion === 0) return;
		const [lat, lon] = untrack(() => center);
		map.panTo([lat, lon]);
	});

	// Bounding box rectangle — updates when center or radius changes
	$effect(() => {
		if (!mapReady || !map) return;
		const bbox = computeBboxLatLon(center[0], center[1], radius);
		const bounds: [[number, number], [number, number]] = [
			[bbox.south, bbox.west],
			[bbox.north, bbox.east]
		];
		if (bboxRect) {
			bboxRect.setBounds(bounds);
		} else {
			import('leaflet').then((L) => {
				bboxRect = L.rectangle(bounds, { color: '#3388ff', weight: 2, fill: false }).addTo(map!);
			});
		}
	});

	interface RenderedRaster {
		dataUrl: string;
		bounds: [[number, number], [number, number]];
		stats: CropStat[];
		palette: CdlPalette | null;
	}

	/**
	 * Decode, parse, and paint one search result. Reads nothing from component
	 * state — the overlay is placed with the snapshot's own lat/lon/radius (audit
	 * B2), never the live center/radius.
	 */
	async function renderSearchResult(result: SearchResult): Promise<RenderedRaster> {
		const binaryStr = atob(result.tifBase64);
		const bytes = new Uint8Array(binaryStr.length);
		for (let i = 0; i < binaryStr.length; i++) {
			bytes[i] = binaryStr.charCodeAt(i);
		}

		// A non-TIFF (e.g. an HTML error page served in place of the raster) would
		// hang georaster's Web Worker forever — reject it up front. See rasterGuards.ts.
		if (!isTiff(bytes)) {
			throw new Error('Search result is not a GeoTIFF');
		}

		const parseGeoraster = await import('georaster').then((m) => m.default);
		// Backstop for any other parse that never settles (same worker issue).
		const georaster = await withTimeout(
			parseGeoraster(bytes.buffer),
			RASTER_PARSE_TIMEOUT_MS,
			'Timed out parsing the crop raster'
		);

		// CDL value 0 is background, but georaster.noDataValue is null and
		// palette[0] is opaque black — so null must be normalized to 0, or
		// background pixels paint black on the map and get counted as a crop.
		const noData = georaster.noDataValue ?? 0;

		const bbox = computeBboxLatLon(result.lat, result.lon, result.radius);
		return {
			dataUrl: rasterToDataUrl(
				georaster.values[0],
				georaster.width,
				georaster.height,
				noData,
				georaster.palette
			),
			bounds: [
				[bbox.south, bbox.west],
				[bbox.north, bbox.east]
			],
			stats: computeCropStats(georaster.values, noData, georaster.palette),
			palette: georaster.palette ?? null
		};
	}

	// GeoTIFF overlay — one cancellable run per search result (src/lib/overlayRun.ts).
	// The teardown cancels the run, and Svelte calls it whenever searchResult changes
	// or the map unmounts. A run still parsing therefore never reaches the map, and a
	// run whose layer is already up removes it. This replaces the identity checks that
	// could orphan a layer when two renders overlapped (audit F1). A fresh result
	// object per search still guarantees a re-run on byte-identical data (audit B3).
	//
	// Outcomes are reported to the page, which is the only writer of loadingMessage
	// (audit F4).
	$effect(() => {
		if (!mapReady || !map || !searchResult) return;
		const result = searchResult;
		const targetMap = map;

		// untrack: startOverlayRun calls render() synchronously, and nothing it
		// reads may become a dependency of this effect — only mapReady/searchResult.
		const run = untrack(() =>
			startOverlayRun<RenderedRaster, import('leaflet').ImageOverlay>(result, {
				render: renderSearchResult,
				createLayer: async ({ dataUrl, bounds }) => {
					const L = await import('leaflet');
					return L.imageOverlay(dataUrl, bounds, { opacity: untrack(() => overlayOpacity) });
				},
				attach: (layer) => {
					layer.addTo(targetMap);
				},
				detach: (layer) => {
					layer.remove();
				},
				onComplete: (rendered, layer) => {
					overlay = layer;
					cropStats = rendered.stats;
					cropPalette = rendered.palette;
					onRenderComplete?.(result);
				},
				onError: (err) => {
					console.error('GeoTIFF rendering error:', err);
					onRenderError?.(result);
				}
			})
		);

		return () => {
			run.cancel();
			overlay = undefined;
			// cropPalette is deliberately NOT cleared: the CDL colormap is near-constant,
			// and clearing it would flicker the swatches back to fallbacks mid-search.
			cropStats = [];
		};
	});

	// Opacity — reactively update when the slider changes, without re-parsing the GeoTIFF
	$effect(() => {
		if (overlay) {
			overlay.setOpacity(overlayOpacity);
		}
	});

	/** Returns the HTML string for a waypoint dot marker icon. */
	function waypointIconHtml(): string {
		return '<div style="width:12px;height:12px;background:#2563eb;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>';
	}

	/**
	 * Returns the HTML string for a waypoint popup.
	 *
	 * Note: Leaflet popups are rendered outside Svelte's component tree, so a plain
	 * HTML string is the only way to inject content. Save/delete actions are bridged
	 * back into Svelte via CustomEvents dispatched on `document`.
	 */
	function waypointPopupHtml(id: number, name: string): string {
		const escapedName = name.replace(/"/g, '&quot;');
		return `
			<div style="min-width:160px">
				<input id="wp-name-${id}" type="text" value="${escapedName}"
					placeholder="Name this waypoint"
					style="width:100%;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;margin-bottom:6px" />
				<div style="display:flex;gap:6px">
					<button onclick="document.dispatchEvent(new CustomEvent('wp-save',{detail:{id:${id},name:document.getElementById('wp-name-${id}').value}}))"
						style="flex:1;padding:4px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px">Save</button>
					<button onclick="document.dispatchEvent(new CustomEvent('wp-delete',{detail:{id:${id}}}))"
						style="flex:1;padding:4px;background:#dc2626;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px">Delete</button>
				</div>
			</div>
		`;
	}

	function addWaypointMarker(
		L: typeof import('leaflet'),
		map: import('leaflet').Map,
		waypoint: Waypoint,
		id: number
	): import('leaflet').Marker {
		const leafletMarker = L.marker([waypoint.lat, waypoint.lon], {
			icon: L.divIcon({
				className: '',
				html: waypointIconHtml(),
				iconSize: [12, 12],
				iconAnchor: [6, 6]
			})
		}).addTo(map);

		const updatePopup = (name?: string) => {
			leafletMarker.bindPopup(waypointPopupHtml(id, name ?? ''));
		};

		updatePopup(waypoint.name);
		waypointMarkers.set(id, leafletMarker);

		const handleSave = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail.id !== id) return;
			const existing = waypointData.get(id);
			if (existing) {
				const updated = { ...existing, name: detail.name };
				waypointData.set(id, updated);
				waypoints = [...waypointData.values()];
				updatePopup(detail.name);
			}
			leafletMarker.closePopup();
		};

		const handleDelete = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail.id !== id) return;
			leafletMarker.remove();
			waypointMarkers.delete(id);
			waypointData.delete(id);
			waypoints = [...waypointData.values()];
			document.removeEventListener('wp-save', handleSave);
			document.removeEventListener('wp-delete', handleDelete);
		};

		document.addEventListener('wp-save', handleSave);
		document.addEventListener('wp-delete', handleDelete);
		cleanupFns.push(
			() => document.removeEventListener('wp-save', handleSave),
			() => document.removeEventListener('wp-delete', handleDelete)
		);

		return leafletMarker;
	}
</script>

<div class="relative h-full w-full">
	<div bind:this={mapContainer} class="h-full w-full"></div>
	<!-- Legend + map hint sit together at the bottom-left -->
	<div class="absolute bottom-4 left-4 z-1000 flex items-end gap-3">
		<Legend colors={cropColors} />
		<p class="pointer-events-none mb-1 text-xs text-gray-400">
			Right-click to add a waypoint &nbsp;·&nbsp; Drag the marker to reposition
		</p>
	</div>
	<LoadingOverlay message={loadingMessage} />
	<ErrorToast message={errorMessage} ondismiss={() => (errorMessage = '')} />
</div>
