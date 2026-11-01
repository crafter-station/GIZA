import { describe, expect, it } from 'vitest';
import { egyptianNumeral, ROYAL_NAMES } from './hieroglyphs.ts';

describe('hieroglyphs', () => {
	it('writes Egyptian numerals with tens (V20) and unit strokes (Z15)', () => {
		expect(egyptianNumeral(1)).toBe('\u{133FA}');
		expect(egyptianNumeral(9)).toBe('\u{13402}');
		expect(egyptianNumeral(10)).toBe('\u{13386}');
		expect(egyptianNumeral(11)).toBe('\u{13386}\u{133FA}');
		expect(() => egyptianNumeral(0)).toThrow();
	});

	it('spells the royal names with the expected Gardiner signs', () => {
		expect([...ROYAL_NAMES.khufu.value.glyphs].map((g) => g.codePointAt(0))).toEqual([
			0x1340d, 0x13171, 0x13191, 0x13171
		]);
		expect([...ROYAL_NAMES.menkaure.value.glyphs]).toHaveLength(6);
	});
});
