/**
 * A completed CDL search, snapshotted at request time.
 *
 * lat/lon/radius/year are captured BEFORE the request is sent, so the overlay is
 * always placed over the bbox that was actually searched — and labelled with the
 * year that was actually fetched — even if the user moves the marker, the radius
 * slider, or the year dropdown while the fetch is in flight.
 *
 * Every completed search produces a NEW object. That fresh identity is what
 * retriggers MapView's overlay $effect, even when two consecutive searches
 * return byte-identical raster data. See audit B2/B3.
 */
export interface SearchResult {
	/** Base64-encoded GeoTIFF returned by the CDL API. */
	tifBase64: string;
	/** Search-time center latitude. */
	lat: number;
	/** Search-time center longitude. */
	lon: number;
	/** Search-time radius in miles. */
	radius: number;
	/** Search-time CDL year — the year this raster actually shows. */
	year: number;
}
