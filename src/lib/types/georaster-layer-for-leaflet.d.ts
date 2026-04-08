declare module 'georaster-layer-for-leaflet' {
	import type { GridLayerOptions, GridLayer, Map } from 'leaflet';
	import type { GeoRaster } from 'georaster';

	interface GeoRasterLayerOptions extends GridLayerOptions {
		georaster: GeoRaster;
		opacity?: number;
		resolution?: number;
		debugLevel?: number;
		proj4?: unknown;
		pixelValuesToColorFn?: (values: number[]) => string | null;
	}

	export default class GeoRasterLayer extends GridLayer {
		constructor(options: GeoRasterLayerOptions);
		addTo(map: Map): this;
	}
}
