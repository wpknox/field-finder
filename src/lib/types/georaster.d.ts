declare module 'georaster' {
	export interface GeoRaster {
		height: number;
		width: number;
		numberOfRasters: number;
		projection: number | string;
		xmin: number;
		ymin: number;
		xmax: number;
		ymax: number;
		pixelHeight: number;
		pixelWidth: number;
		values: number[][][];
		noDataValue: number | null;
	}

	export default function parseGeoraster(input: ArrayBuffer): Promise<GeoRaster>;
}
