import { fact } from '../content/sources.ts';
import { MONUMENT_COORDINATES, toLocal } from './geo.ts';

const dms = (d: number, m = 0, s = 0) => d + m / 60 + s / 3600;

export const KHUFU = {
	id: 'khufu',
	position: toLocal(MONUMENT_COORDINATES.khufu),
	baseSide: fact(230.3, { unit: 'm', status: 'established', sources: ['lehnerHawass2017'], checked: 'secondary' }),
	originalHeight: fact(146.6, { unit: 'm', status: 'established', sources: ['lehner1997'], checked: 'secondary' }),
	currentHeight: fact(138.5, { unit: 'm', status: 'established', sources: ['wikipediaGiza'], checked: 'secondary' }),
	slope: fact(dms(51, 50, 40), {
		unit: '°',
		status: 'established',
		sources: ['lehner1997'],
		checked: 'secondary',
		note: 'Seked of 5½ palms.'
	}),
	volume: fact(2.6e6, {
		unit: 'm³',
		status: 'estimate',
		sources: ['lehnerHawass2017'],
		checked: 'secondary',
		note: 'Includes a natural rock hillock inside the core.'
	}),
	blockCount: fact(2.3e6, {
		status: 'estimate',
		sources: ['romer2007'],
		checked: 'secondary',
		note: 'An estimate, not a count.'
	}),
	mass: fact(6e6, { unit: 't', status: 'estimate', sources: ['wikipediaGiza'], checked: 'secondary' }),
	courses: fact(203, {
		status: 'established',
		sources: ['wikipediaGiza', 'petrie1883'],
		checked: 'secondary',
		note: 'Courses remaining today; course heights vary irregularly with height.'
	}),
	orientationError: fact(dms(0, 3, 38), {
		unit: '°',
		status: 'established',
		sources: ['wikipediaGiza'],
		checked: 'secondary',
		note: 'Mean deviation of the sides from true north, south, east and west.'
	}),
	concaveFaces: fact(true, {
		status: 'established',
		sources: ['petrie1883'],
		checked: 'secondary',
		note: 'Faces are slightly hollowed; later surveys attribute it to casing removal.'
	}),
	kingsChamber: fact(
		{ length: 10.5, width: 5.2, height: 5.8 },
		{ unit: 'm', status: 'established', sources: ['wikipediaGiza', 'lehner1997'], checked: 'secondary' }
	),
	grandGallery: fact(
		{ length: 46.68, height: 8.6 },
		{ unit: 'm', status: 'established', sources: ['wikipediaGiza', 'lehner1997'], checked: 'secondary' }
	),
	bigVoid: fact(
		{ minLength: 30, discovered: 2017 },
		{
			unit: 'm',
			status: 'established',
			sources: ['morishima2017'],
			checked: 'secondary',
			note: 'Detected by muography; no access.'
		}
	),
	northFaceCorridor: fact(
		{ length: 9, section: 2, confirmed: 2023 },
		{ unit: 'm', status: 'established', sources: ['procureur2023'], checked: 'secondary' }
	),
	reign: fact(
		{ fromBce: 2613, toBce: 2577 },
		{
			status: 'estimate',
			sources: ['ramsey2010'],
			checked: 'secondary',
			note: 'Radiocarbon-based range; conventional dates are around 2589–2566 BCE.'
		}
	),
	constructionYears: fact(
		{ min: 20, attestedYear: 27 },
		{
			status: 'estimate',
			sources: ['tallet2017', 'wikipediaGiza'],
			checked: 'secondary',
			note: 'Herodotus gives 20 years; the Diary of Merer shows Tura limestone still being shipped to Giza in year 26–27 of Khufu.'
		}
	)
} as const;

export const KHUFU_OPENINGS = {
	entrance: fact(
		{ height: 17, course: 19, eastOfCenter: 7.9 },
		{
			unit: 'm',
			status: 'established',
			sources: ['wikipediaGiza', 'lehner1997'],
			checked: 'secondary',
			note: 'Original entrance on the north face, 15 royal cubits east of the centre line.'
		}
	),
	robbersTunnel: fact(
		{ height: 7, courses: [6, 7] },
		{
			unit: 'm',
			status: 'established',
			sources: ['wikipediaGiza'],
			checked: 'secondary',
			note: 'Forced through the 6th and 7th courses, traditionally attributed to al-Maʾmun (c. 820 CE). Horizontal position shown schematically below the entrance.'
		}
	),
	casingRemnants: fact('A few casing stones of the lowest course remain on each side, best preserved on the north.', {
		status: 'established',
		sources: ['wikipediaGiza'],
		checked: 'secondary'
	})
} as const;

export const KHAFRE = {
	id: 'khafre',
	position: toLocal(MONUMENT_COORDINATES.khafre),
	baseSide: fact(215.25, { unit: 'm', status: 'established', sources: ['verner2001'], checked: 'secondary' }),
	originalHeight: fact(143.5, { unit: 'm', status: 'established', sources: ['wikipediaGiza'], checked: 'secondary' }),
	currentHeight: fact(136.4, { unit: 'm', status: 'established', sources: ['wikipediaGiza'], checked: 'secondary' }),
	slope: fact(dms(53, 10), {
		unit: '°',
		status: 'established',
		sources: ['verner2001', 'lehner1997'],
		checked: 'secondary',
		note: 'Some sources give 53°08′.'
	}),
	volume: fact(2_211_096, { unit: 'm³', status: 'estimate', sources: ['lehner1997'], checked: 'secondary' }),
	bedrockAboveKhufu: fact(10, {
		unit: 'm',
		status: 'established',
		sources: ['wikipediaGiza'],
		checked: 'secondary',
		note: 'Why it looks taller than Khufu.'
	}),
	casing: fact('Tura limestone casing survives on the top third; the lowest course was pink granite.', {
		status: 'established',
		sources: ['wikipediaGiza'],
		checked: 'secondary'
	})
} as const;

export const MENKAURE = {
	id: 'menkaure',
	position: toLocal(MONUMENT_COORDINATES.menkaure),
	base: fact(
		{ a: 102.2, b: 104.6 },
		{ unit: 'm', status: 'established', sources: ['wikipediaGiza'], checked: 'secondary' }
	),
	originalHeight: fact(65.5, {
		unit: 'm',
		status: 'estimate',
		sources: ['wikipediaGiza'],
		checked: 'secondary',
		note: 'Some sources give 65 m.'
	}),
	currentHeight: fact(61, { unit: 'm', status: 'established', sources: ['wikipediaGiza'], checked: 'secondary' }),
	slope: fact(dms(51, 20, 25), { unit: '°', status: 'established', sources: ['wikipediaGiza'], checked: 'secondary' }),
	volume: fact(235_183, { unit: 'm³', status: 'estimate', sources: ['wikipediaGiza'], checked: 'secondary' }),
	graniteCourses: fact(16, {
		status: 'established',
		sources: ['wikipediaGiza'],
		checked: 'secondary',
		note: 'The lowest 16 courses were cased in Aswan granite, partly left undressed.'
	}),
	demolitionAttempt: fact(1196, {
		status: 'established',
		sources: ['lehner1997'],
		checked: 'secondary',
		note: 'Sultan al-Aziz Uthman; left the vertical gash on the north face.'
	})
} as const;

export const QUEENS = {
	g1a: fact(
		{ base: 49.5, height: 30 },
		{
			unit: 'm',
			status: 'estimate',
			sources: ['wikipediaGiza'],
			checked: 'secondary',
			note: 'Northernmost queen pyramid, about 10 m north of G1-b; position derived from G1-b.'
		}
	),
	g1b: fact(
		{ lat: 29 + 58 / 60 + 42 / 3600, lon: 31 + 8 / 60 + 10 / 3600, base: 50, height: 30 },
		{ unit: 'm', status: 'established', sources: ['wikipediaGiza'], checked: 'secondary' }
	),
	g1c: fact(
		{ lat: 29.97785, lon: 31.1362556, base: 46.25, height: 29.6 },
		{
			unit: 'm',
			status: 'established',
			sources: ['verner2001', 'wikipediaGiza'],
			checked: 'secondary',
			note: 'Attributed to Queen Henutsen.'
		}
	),
	g3a: fact(
		{ lat: 29 + 58 / 60 + 18 / 3600, lon: 31 + 7 / 60 + 42 / 3600, base: 44, height: 28.4, current: 25.4 },
		{
			unit: 'm',
			status: 'established',
			sources: ['verner2001', 'lehner1997', 'wikipediaGiza'],
			checked: 'secondary',
			note: 'Easternmost and only true pyramid of the three.'
		}
	),
	g3b: fact(
		{ lat: 29 + 58 / 60 + 18 / 3600, lon: 31 + 7 / 60 + 40 / 3600, base: 31.24, steps: 4 },
		{ unit: 'm', status: 'established', sources: ['verner2001', 'wikipediaGiza'], checked: 'secondary' }
	),
	g3c: fact(
		{ steps: 4 },
		{
			status: 'estimate',
			sources: ['wikipediaGiza'],
			checked: 'secondary',
			note: 'Westernmost step pyramid; size and position assumed equal to G3-b and evenly spaced.'
		}
	)
} as const;

export const SPHINX = {
	id: 'sphinx',
	position: toLocal(MONUMENT_COORDINATES.sphinx),
	size: fact(
		{ length: 73, height: 20, width: 19 },
		{ unit: 'm', status: 'established', sources: ['wikipediaGiza'], checked: 'secondary' }
	),
	facing: fact('east', { status: 'established', sources: ['wikipediaGiza'], checked: 'secondary' })
} as const;

export const DERIVED = {
	noNoonShadow: fact(
		{ from: '02-28', to: '10-13', slope: KHUFU.slope.value },
		{
			status: 'estimate',
			sources: ['lehner1997'],
			checked: 'computed',
			note: 'Days when the noon sun at Giza stands higher than Khufu’s slope, computed with suncalc for 2026 (±1 day between years). Tested in pyramids.spec.ts.'
		}
	),
	blocksPerDay: fact(
		{ blocks: 2.3e6, years: 26, perDay: 242 },
		{
			status: 'estimate',
			sources: ['romer2007', 'tallet2017'],
			checked: 'computed',
			note: '2.3 M blocks over ~26 years ≈ 240 blocks a day, about one every 2.5 minutes in a 10-hour working day.'
		}
	),
	workforce: fact(
		{ min: 20_000, max: 30_000 },
		{
			status: 'estimate',
			sources: ['novaBuilders', 'aeraLostCity'],
			checked: 'secondary',
			note: 'Rotating paid crews housed and fed near Heit el-Ghurab; not slaves.'
		}
	)
} as const;
