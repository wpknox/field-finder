/**
 * Guards around parsing a CDL raster in the browser.
 *
 * georaster 1.6.0 parses in a Web Worker and never listens for worker errors
 * (node_modules/georaster/src/index.js sets onmessage, not onerror). A payload
 * the worker cannot parse therefore produces a promise that NEVER settles, and
 * the app would sit on "Rendering crop overlay…" forever. These guards turn
 * both failure shapes into ordinary rejections that the overlay run reports.
 */

/** Generous: a 50-mile raster parses in seconds. Only a hung parse hits this. */
export const RASTER_PARSE_TIMEOUT_MS = 60_000;

/**
 * True when `bytes` starts with a TIFF or BigTIFF header: byte-order mark
 * `II` (little-endian) or `MM` (big-endian), then magic 42 (TIFF) or 43
 * (BigTIFF) in that byte order. Catches an HTML/XML error page served in
 * place of a raster before it ever reaches the worker.
 */
export function isTiff(bytes: Uint8Array): boolean {
	if (bytes.length < 4) return false;
	const [a, b, c, d] = bytes;
	if (a === 0x49 && b === 0x49) return d === 0x00 && (c === 0x2a || c === 0x2b);
	if (a === 0x4d && b === 0x4d) return c === 0x00 && (d === 0x2a || d === 0x2b);
	return false;
}

/**
 * Reject with `message` if `promise` has not settled within `ms`. The timer is
 * cleared as soon as the promise settles either way.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error(message)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
