import { describe, it, expect, vi, afterEach } from 'vitest';
import { isTiff, withTimeout, RASTER_PARSE_TIMEOUT_MS } from './rasterGuards';

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new TextEncoder().encode(s);

describe('isTiff', () => {
	it('accepts little-endian TIFF (II*\\0)', () => {
		expect(isTiff(bytes(0x49, 0x49, 0x2a, 0x00, 0x08, 0x00))).toBe(true);
	});

	it('accepts big-endian TIFF (MM\\0*)', () => {
		expect(isTiff(bytes(0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x08))).toBe(true);
	});

	it('accepts BigTIFF in both byte orders', () => {
		expect(isTiff(bytes(0x49, 0x49, 0x2b, 0x00))).toBe(true);
		expect(isTiff(bytes(0x4d, 0x4d, 0x00, 0x2b))).toBe(true);
	});

	// What a misbehaving upstream actually returns in place of a raster.
	it('rejects HTML, XML, and plain text', () => {
		expect(isTiff(ascii('<!DOCTYPE html><html>'))).toBe(false);
		expect(isTiff(ascii('<?xml version="1.0"?>'))).toBe(false);
		expect(isTiff(ascii('not a tif'))).toBe(false);
	});

	it('rejects input shorter than the 4-byte header', () => {
		expect(isTiff(bytes())).toBe(false);
		expect(isTiff(bytes(0x49, 0x49, 0x2a))).toBe(false);
	});

	it('rejects a mixed byte-order marker', () => {
		expect(isTiff(bytes(0x49, 0x4d, 0x2a, 0x00))).toBe(false);
	});
});

describe('withTimeout', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('resolves with the value when the promise settles in time', async () => {
		await expect(withTimeout(Promise.resolve('ok'), 1000, 'too slow')).resolves.toBe('ok');
	});

	it('passes through a rejection from the promise', async () => {
		const failure = new Error('bad');
		await expect(withTimeout(Promise.reject(failure), 1000, 'too slow')).rejects.toBe(failure);
	});

	// The georaster Web Worker case: a promise that never settles.
	it('rejects with the given message when the promise never settles', async () => {
		vi.useFakeTimers();
		const pending = withTimeout(new Promise<never>(() => {}), 5000, 'Raster parse timed out');
		const assertion = expect(pending).rejects.toThrow('Raster parse timed out');
		await vi.advanceTimersByTimeAsync(5000);
		await assertion;
	});

	it('does not reject before the timeout elapses', async () => {
		vi.useFakeTimers();
		let settled = false;
		withTimeout(new Promise<never>(() => {}), 5000, 'x').catch(() => {
			settled = true;
		});
		await vi.advanceTimersByTimeAsync(4999);
		expect(settled).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(settled).toBe(true);
	});

	it('clears its timer once the promise settles', async () => {
		vi.useFakeTimers();
		await withTimeout(Promise.resolve(1), 5000, 'x');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('defaults to a generous parse timeout', () => {
		expect(RASTER_PARSE_TIMEOUT_MS).toBe(60_000);
	});
});
