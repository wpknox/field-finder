import type { AlbersBbox } from './coordinates';

const CDL_BASE = 'https://nassgeodata.gmu.edu/axis2/services/CDLService';

/** Default per-request timeout for CDL calls. NASS hangs rather than erroring. */
export const CDL_TIMEOUT_MS = 60_000;

/** Thrown when a CDL request exceeds its timeout, so callers can report it distinctly. */
export class CdlTimeoutError extends Error {
	constructor(step: string) {
		super(`CDL request timed out during ${step}`);
		this.name = 'CdlTimeoutError';
	}
}

/** True for the DOMException fetch raises when an AbortSignal.timeout() fires. */
export function isTimeoutError(err: unknown): boolean {
	return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
}

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
	onProgress?: (step: CdlProgressStep) => void,
	timeoutMs: number = CDL_TIMEOUT_MS
): Promise<string> {
	const get = async (url: string, step: string): Promise<Response> => {
		try {
			return await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
		} catch (err) {
			if (isTimeoutError(err)) throw new CdlTimeoutError(step);
			throw err;
		}
	};

	// Step 1: Get raster file
	onProgress?.('fetching');
	const cdlFileUrl = buildCdlFileUrl(request.year, request.albers);
	const rasterResp = await get(cdlFileUrl, 'GetCDLFile');
	if (!rasterResp.ok) {
		throw new Error(`CDL GetCDLFile failed: ${rasterResp.status}`);
	}
	let rasterUrl = parseReturnUrl(await rasterResp.text());

	// Step 2: Filter by crop values (if any)
	if (request.crops.length > 0) {
		onProgress?.('extracting');
		const extractUrl = buildExtractUrl(rasterUrl, request.crops);
		const extractResp = await get(extractUrl, 'ExtractCDLByValues');
		if (!extractResp.ok) {
			throw new Error(`CDL ExtractCDLByValues failed: ${extractResp.status}`);
		}
		rasterUrl = parseReturnUrl(await extractResp.text());
	}

	return rasterUrl;
}
