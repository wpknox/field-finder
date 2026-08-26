import type { AlbersBbox } from './coordinates';

const CDL_BASE = 'https://nassgeodata.gmu.edu/axis2/services/CDLService';

export function buildCdlFileUrl(year: number, bbox: AlbersBbox): string {
	const bboxStr = `${bbox.xMin},${bbox.yMin},${bbox.xMax},${bbox.yMax}`;
	return `${CDL_BASE}/GetCDLFile?year=${year}&bbox=${bboxStr}`;
}

export function buildExtractUrl(rasterUrl: string, cropValues: number[]): string {
	return `${CDL_BASE}/ExtractCDLByValues?file=${encodeURIComponent(rasterUrl)}&values=${cropValues.join(',')}`;
}


/**
 * Parse the <returnURL> or <returnURLArray> element from CDL API XML response.
 * GetCDLFile and ExtractCDLByValues return <returnURL>.
 * GetCDLImage returns <returnURLArray> (contains the first/only PNG URL).
 */
export function parseReturnUrl(xml: string): string {
	const match = xml.match(/<returnURL(?:Array)?>(.*?)<\/returnURL(?:Array)?>/);
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

export type CdlProgressStep = 'fetching' | 'extracting';

/**
 * Execute the CDL API call chain:
 * 1. GetCDLFile → raster URL
 * 2. ExtractCDLByValues → filtered raster URL (if crops specified)
 *
 * Returns the raster (.tif) URL directly — the client renders it with georaster.
 * Accepts an optional fetch function for testing and an optional onProgress
 * callback invoked before each step so callers can stream progress to clients.
 */
export async function fetchCdlData(
	request: CdlRequest,
	fetchFn: typeof fetch = fetch,
	onProgress?: (step: CdlProgressStep) => void
): Promise<string> {
	// Step 1: Get raster file
	onProgress?.('fetching');
	const cdlFileUrl = buildCdlFileUrl(request.year, request.albers);
	const rasterResp = await fetchFn(cdlFileUrl);
	if (!rasterResp.ok) {
		throw new Error(`CDL GetCDLFile failed: ${rasterResp.status}`);
	}
	let rasterUrl = parseReturnUrl(await rasterResp.text());

	// Step 2: Filter by crop values (if any)
	if (request.crops.length > 0) {
		onProgress?.('extracting');
		const extractUrl = buildExtractUrl(rasterUrl, request.crops);
		const extractResp = await fetchFn(extractUrl);
		if (!extractResp.ok) {
			throw new Error(`CDL ExtractCDLByValues failed: ${extractResp.status}`);
		}
		rasterUrl = parseReturnUrl(await extractResp.text());
	}

	return rasterUrl;
}
