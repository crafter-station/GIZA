export const INCH = 0.0254;

export const PETRIE_ANCHORS = {
	courses: 203,
	totalInches: 5408,
	firstCourse: 58.6,
	secondCourse: 49.1,
	topOfSixth: 278.1,
	doorwayCourse: 19,
	doorwayThickness: 37.94,
	thinPair: [20, 21],
	thinUntil: 77,
	peakCourse: 35,
	calmAbove: 154
} as const;

function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function peakCourses(next: () => number): number[] {
	const fixed = [1, PETRIE_ANCHORS.doorwayCourse, PETRIE_ANCHORS.peakCourse];
	const peaks = new Set<number>(fixed);
	while (peaks.size < 23) {
		const course = 40 + Math.floor(next() * (PETRIE_ANCHORS.calmAbove - 40));
		if ([...peaks].every((peak) => Math.abs(peak - course) >= 4)) peaks.add(course);
	}
	for (const course of [166, 181, 194]) peaks.add(course);
	return [...peaks].sort((a, b) => a - b);
}

export function reconstructKhufuCourses(seed = 1883): number[] {
	const next = random(seed);
	const n = PETRIE_ANCHORS.courses;
	const trend = (course: number) => 46 - (course / n) * 24;
	const peaks = peakCourses(next);
	const raw = Array.from({ length: n }, (_, i) => {
		const course = i + 1;
		const previousPeak = peaks.filter((peak) => peak <= course).at(-1) ?? 1;
		const sinceRun = course - previousPeak;
		const calm = course > PETRIE_ANCHORS.calmAbove ? 0.4 : 1;
		const boost = previousPeak === course ? 1.22 : 1.12 - Math.min(sinceRun, 10) * 0.025;
		return trend(course) * (1 + (boost - 1) * calm) * (1 + (next() - 0.5) * 0.04 * calm);
	});

	raw[0] = PETRIE_ANCHORS.firstCourse;
	raw[1] = PETRIE_ANCHORS.secondCourse;
	const third = raw.slice(2, 6).reduce((sum, value) => sum + value, 0);
	const remainingToSixth = PETRIE_ANCHORS.topOfSixth - PETRIE_ANCHORS.firstCourse - PETRIE_ANCHORS.secondCourse;
	for (let i = 2; i < 6; i++) raw[i] *= remainingToSixth / third;

	const doorway = PETRIE_ANCHORS.doorwayCourse - 1;
	raw[doorway] = PETRIE_ANCHORS.doorwayThickness;
	for (let i = doorway - 11; i < doorway; i++) raw[i] = Math.min(raw[i], PETRIE_ANCHORS.doorwayThickness - 1.5);
	for (let i = doorway + 1; i <= doorway + 14; i++) raw[i] = Math.min(raw[i], PETRIE_ANCHORS.doorwayThickness - 1.5);

	const fixedIndices = new Set([0, 1, 2, 3, 4, 5, doorway]);
	const thinFloor = Math.min(...raw.slice(6, PETRIE_ANCHORS.thinUntil - 1).filter((_, i) => !fixedIndices.has(i + 6)));
	for (const course of PETRIE_ANCHORS.thinPair) {
		raw[course - 1] = thinFloor - 2;
		fixedIndices.add(course - 1);
	}

	const fixedSum = [...fixedIndices].reduce((sum, i) => sum + raw[i], 0);
	const freeSum = raw.reduce((sum, value, i) => (fixedIndices.has(i) ? sum : sum + value), 0);
	const factor = (PETRIE_ANCHORS.totalInches - fixedSum) / freeSum;
	const scaled = raw.map((value, i) => (fixedIndices.has(i) ? value : value * factor));
	for (const course of PETRIE_ANCHORS.thinPair) {
		const floor = Math.min(
			...scaled
				.slice(6, PETRIE_ANCHORS.thinUntil - 1)
				.filter((_, i) => !(PETRIE_ANCHORS.thinPair as readonly number[]).includes(i + 7))
		);
		scaled[course - 1] = Math.min(scaled[course - 1], floor - 1);
	}
	const correction = PETRIE_ANCHORS.totalInches - scaled.reduce((sum, value) => sum + value, 0);
	const adjustable = scaled.length - 1;
	scaled[adjustable] += correction;
	return scaled.map((inches) => inches * INCH);
}

export const KHUFU_COURSES: readonly number[] = reconstructKhufuCourses();
