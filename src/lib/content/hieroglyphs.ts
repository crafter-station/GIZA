import { fact } from './sources.ts';

const UNITS = ['', '𓏺', '𓏻', '𓏼', '𓏽', '𓏾', '𓏿', '𓐀', '𓐁', '𓐂'] as const;
const TEN = '𓎆';

export const ROYAL_NAMES = {
	khufu: fact(
		{ glyphs: '𓐍𓅱𓆑𓅱', transliteration: 'ḫwfw', gardiner: 'Aa1 G43 I9 G43' },
		{ status: 'established', sources: ['lehner1997'], checked: 'secondary' }
	),
	khafre: fact(
		{ glyphs: '𓇳𓈍𓆑', transliteration: 'ḫꜥ.f-rꜥ', gardiner: 'N5 N28 I9' },
		{
			status: 'established',
			sources: ['lehner1997'],
			checked: 'secondary',
			note: 'The sun sign N5 is written first out of respect but read last.'
		}
	),
	menkaure: fact(
		{ glyphs: '𓇳𓏠𓈖𓂓𓂓𓂓', transliteration: 'mn-kꜣw-rꜥ', gardiner: 'N5 Y5 N35 D28 D28 D28' },
		{
			status: 'established',
			sources: ['lehner1997'],
			checked: 'secondary',
			note: 'The sun sign N5 is written first out of respect but read last.'
		}
	)
} as const;

export function egyptianNumeral(value: number): string {
	if (!Number.isInteger(value) || value < 1 || value > 99) throw new RangeError(`Unsupported numeral: ${value}`);
	return TEN.repeat(Math.floor(value / 10)) + UNITS[value % 10];
}
