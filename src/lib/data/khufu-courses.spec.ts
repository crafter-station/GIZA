import { describe, expect, it } from 'vitest';
import { INCH, KHUFU_COURSE_RECORDS, KHUFU_SURVIVING_COURSES_M } from './khufu-courses.ts';

describe('Khufu course table (Petrie, Plate VIII)', () => {
	it('keeps all 203 records with their original course numbers', () => {
		expect(KHUFU_COURSE_RECORDS).toHaveLength(203);
		expect(KHUFU_COURSE_RECORDS.map((record) => record.course)).toEqual(Array.from({ length: 203 }, (_, i) => i + 1));
	});

	it('derives each N.E. thickness from the cumulative levels', () => {
		let previous = 0;
		for (const record of KHUFU_COURSE_RECORDS) {
			expect(record.neLevel - previous).toBeCloseTo(record.neThickness, 1);
			previous = record.neLevel;
		}
	});

	it('marks the annotated courses and the two obliterated top courses', () => {
		const annotated = KHUFU_COURSE_RECORDS.filter((record) => record.annotated).map((record) => record.course);
		expect(annotated).toEqual([2, 3, 70, 110, 132, 202, 203]);
		expect(KHUFU_COURSE_RECORDS.filter((record) => !record.surviving).map((record) => record.course)).toEqual([
			202, 203
		]);
		expect(KHUFU_COURSE_RECORDS[201].swLevel).toBeNull();
	});

	it('builds today’s pyramid from the 201 surviving courses, in metres', () => {
		expect(KHUFU_SURVIVING_COURSES_M).toHaveLength(201);
		const height = KHUFU_SURVIVING_COURSES_M.reduce((sum, value) => sum + value, 0);
		expect(height).toBeCloseTo(5407.9 * INCH, 3);
		expect(KHUFU_SURVIVING_COURSES_M[0]).toBeCloseTo(58.6 * INCH, 6);
		expect(KHUFU_SURVIVING_COURSES_M[18]).toBeCloseTo(38.1 * INCH, 6);
	});
});
