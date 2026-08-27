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

/** Names DOMException uses when an AbortSignal fires. */
const ABORT_NAMES = new Set(['TimeoutError', 'AbortError']);

/**
 * Undici error codes meaning "the upstream never answered in time". Node's fetch
 * reports transport failures as `TypeError: fetch failed` and hangs the real reason
 * off `.cause`, so a top-level name check cannot see these.
 */
const UPSTREAM_TIMEOUT_CODES = new Set([
	'UND_ERR_CONNECT_TIMEOUT',
	'UND_ERR_HEADERS_TIMEOUT',
	'UND_ERR_BODY_TIMEOUT'
]);

/**
 * True when a fetch rejection means "CDL did not respond in time".
 *
 * Two shapes reach us, and both must be recognised:
 *  - our own `AbortSignal.timeout()` firing → a DOMException named `TimeoutError`
 *  - undici giving up first → `TypeError: fetch failed` with a `ConnectTimeoutError`
 *    on `.cause`. Undici's connect timeout is 10s, well under `CDL_TIMEOUT_MS`, so
 *    when NASS is unreachable (rather than merely slow) this is the shape that
 *    actually occurs — the AbortSignal never gets the chance to fire.
 *
 * Deliberately does NOT match unreachable-host failures (`ECONNREFUSED`,
 * `ENOTFOUND`): those mean something different from "not responding" and keep the
 * generic error message.
 */
export function isTimeoutError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	if (ABORT_NAMES.has(err.name)) return true;

	const cause: unknown = (err as { cause?: unknown }).cause;
	if (!(cause instanceof Error)) return false;
	if (ABORT_NAMES.has(cause.name)) return true;

	const code = (cause as { code?: unknown }).code;
	return typeof code === 'string' && UPSTREAM_TIMEOUT_CODES.has(code);
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
