import type { AlbersBbox } from './coordinates';

const CDL_BASE = 'https://nassgeodata.gmu.edu/axis2/services/CDLService';

export function buildCdlFileUrl(year: number, bbox: AlbersBbox): string {
	const bboxStr = `${bbox.xMin},${bbox.yMin},${bbox.xMax},${bbox.yMax}`;
	return `${CDL_BASE}/GetCDLFile?year=${year}&bbox=${bboxStr}`;
}

export function buildExtractUrl(rasterUrl: string, cropValues: number[]): string {
	return `${CDL_BASE}/ExtractCDLByValues?file=${encodeURIComponent(rasterUrl)}&values=${cropValues.join(',')}`;
}

export function buildImageUrl(rasterUrl: string): string {
	return `${CDL_BASE}/GetCDLImage?files=${encodeURIComponent(rasterUrl)}&format=png`;
}

/**
 * Parse the <returnURL> element from CDL API XML response.
 * The CDL API wraps results in various XML envelopes but always uses <returnURL>.
 */
export function parseReturnUrl(xml: string): string {
	const match = xml.match(/<returnURL>(.*?)<\/returnURL>/);
	if (!match) {
		throw new Error(`CDL API response missing <returnURL>: ${xml.slice(0, 200)}`);
	}
	return match[1];
}

export interface CdlRequest {
	year: number;
	albers: AlbersBbox;
	crops: number[];
}

/**
 * Execute the CDL API call chain:
 * 1. GetCDLFile → raster URL
 * 2. ExtractCDLByValues → filtered raster URL (if crops specified)
 * 3. GetCDLImage → PNG URL
 *
 * Accepts an optional fetch function for testing.
 */
export async function fetchCdlData(
	request: CdlRequest,
	fetchFn: typeof fetch = fetch
): Promise<string> {
	// Step 1: Get raster file
	const cdlFileUrl = buildCdlFileUrl(request.year, request.albers);
	const rasterResp = await fetchFn(cdlFileUrl);
	if (!rasterResp.ok) {
		throw new Error(`CDL GetCDLFile failed: ${rasterResp.status}`);
	}
	let rasterUrl = parseReturnUrl(await rasterResp.text());

	// Step 2: Filter by crop values (if any)
	if (request.crops.length > 0) {
		const extractUrl = buildExtractUrl(rasterUrl, request.crops);
		const extractResp = await fetchFn(extractUrl);
		if (!extractResp.ok) {
			throw new Error(`CDL ExtractCDLByValues failed: ${extractResp.status}`);
		}
		rasterUrl = parseReturnUrl(await extractResp.text());
	}

	// Step 3: Get PNG image
	const imageUrl = buildImageUrl(rasterUrl);
	const imageResp = await fetchFn(imageUrl);
	if (!imageResp.ok) {
		throw new Error(`CDL GetCDLImage failed: ${imageResp.status}`);
	}
	return parseReturnUrl(await imageResp.text());
}
