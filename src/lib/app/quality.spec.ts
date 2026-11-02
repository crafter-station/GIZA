import { describe, expect, it } from 'vitest';
import { parseFlags } from './flags.ts';
import { clampTier, initialTier, tierAfterBenchmark } from './quality.ts';

describe('quality tiers', () => {
	it('caps the WebGL2 fallback at medium', () => {
		expect(clampTier('ultra', 'webgl2')).toBe('medium');
		expect(initialTier('webgl2', false)).toBe('medium');
		expect(initialTier('webgpu', false)).toBe('ultra');
		expect(initialTier('webgpu', true)).toBe('low');
	});

	it('steps down only when frames are slow', () => {
		expect(tierAfterBenchmark('ultra', 16.7)).toBeNull();
		expect(tierAfterBenchmark('ultra', 33)).toBe('high');
		expect(tierAfterBenchmark('low', 50)).toBeNull();
	});
});

describe('URL flags', () => {
	it('parses known flags and ignores invalid values', () => {
		expect(parseFlags('?backend=webgl&tier=low&perf&t=4.5')).toMatchObject({
			backend: 'webgl',
			tier: 'low',
			perf: true,
			t: 4.5
		});
		expect(parseFlags('?tier=extreme&t=-1')).toMatchObject({ backend: 'auto', tier: null, perf: false, t: null });
	});
});
