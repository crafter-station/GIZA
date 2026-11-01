import { describe, expect, it } from 'vitest';
import { INCH, KHUFU_COURSES, PETRIE_ANCHORS } from './khufu-courses.ts';

const inches = KHUFU_COURSES.map((meters) => meters / INCH);
const sum = (from: number, to: number) => inches.slice(from, to).reduce((total, value) => total + value, 0);

describe('Khufu course profile', () => {
	it('has 203 courses reaching the present top measured by Petrie', () => {
		expect(inches).toHaveLength(203);
		expect(sum(0, 203)).toBeCloseTo(PETRIE_ANCHORS.totalInches, 3);
		expect(Math.min(...inches)).toBeGreaterThan(15);
	});

	it('honours the course levels Petrie gives in the text', () => {
		expect(inches[0]).toBeCloseTo(58.6, 3);
		expect(sum(0, 2)).toBeCloseTo(107.7, 3);
		expect(sum(0, 6)).toBeCloseTo(278.1, 3);
	});

	it('makes course 19 the doorway course, thicker than the 11 below and 14 above', () => {
		const doorway = inches[18];
		expect(doorway).toBeCloseTo(37.94, 3);
		for (let i = 7; i < 18; i++) expect(inches[i]).toBeLessThan(doorway);
		for (let i = 19; i < 33; i++) expect(inches[i]).toBeLessThan(doorway);
	});

	it('makes courses 20 and 21 the thinnest until course 77', () => {
		const rest = inches.slice(6, 76).filter((_, i) => i + 7 !== 20 && i + 7 !== 21);
		expect(inches[19]).toBeLessThan(Math.min(...rest));
		expect(inches[20]).toBeLessThan(Math.min(...rest));
	});

	it('gets thinner towards the top', () => {
		expect(sum(150, 203) / 53).toBeLessThan(sum(6, 60) / 54);
	});
});
