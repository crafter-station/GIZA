import type { CameraKey, Vec3 } from './track.ts';

export interface Shot {
	at: number;
	position: Vec3;
	target: Vec3;
	fov: number;
}

export interface Chapter {
	id: string;
	title: string;
	summary: string;
	blockActions: boolean;
	shots: readonly Shot[];
}

export const CHAPTERS: readonly Chapter[] = [
	{
		id: 'dawn',
		title: 'Dawn at Giza',
		summary: 'Three pyramids rise from the edge of the Western Desert, above the green valley of the Nile.',
		blockActions: false,
		shots: [
			{ at: 0, position: [-700, 60, 1900], target: [-280, 70, 360], fov: 38 },
			{ at: 0.8, position: [-520, 45, 1620], target: [-260, 60, 340], fov: 38 }
		]
	},
	{
		id: 'plateau',
		title: 'The plateau',
		summary:
			'Seen from above, the pyramids follow a diagonal from northeast to southwest, and their sides face the cardinal points almost exactly.',
		blockActions: false,
		shots: [
			{ at: 0.2, position: [-300, 1500, 1050], target: [-280, 0, 380], fov: 40 },
			{ at: 0.8, position: [-280, 1650, 700], target: [-280, 0, 380], fov: 40 }
		]
	},
	{
		id: 'khufu',
		title: 'Khufu, the Great Pyramid',
		summary:
			'Built for Khufu in the 26th century BCE: 230 meters per side, originally 146.6 meters tall, and an estimated 2.3 million blocks. Take it apart.',
		blockActions: true,
		shots: [
			{ at: 0.2, position: [520, 140, -480], target: [0, 60, 0], fov: 42 },
			{ at: 0.8, position: [430, 110, -400], target: [0, 60, 0], fov: 42 }
		]
	},
	{
		id: 'inside-khufu',
		title: 'Inside Khufu',
		summary:
			'Passages, the Grand Gallery, the Queen’s and King’s Chambers, and a large void detected with cosmic-ray muons in 2017.',
		blockActions: true,
		shots: [
			{ at: 0.2, position: [180, 50, -340], target: [0, 45, 0], fov: 45 },
			{ at: 0.8, position: [60, 40, -300], target: [0, 50, 0], fov: 45 }
		]
	},
	{
		id: 'khafre',
		title: 'Khafre and the Sphinx',
		summary:
			'Khafre’s pyramid keeps part of its smooth casing near the top and stands on bedrock about 10 meters higher, so it looks taller than Khufu.',
		blockActions: false,
		shots: [
			{ at: 0, position: [520, 110, 200], target: [80, 40, 400], fov: 40 },
			{ at: 0.2, position: [700, 25, 520], target: [80, 40, 400], fov: 40 },
			{ at: 0.8, position: [560, 18, 470], target: [0, 50, 390], fov: 40 }
		]
	},
	{
		id: 'menkaure',
		title: 'Menkaure',
		summary:
			'The smallest of the three. Its lowest courses were cased in red Aswan granite, and a gash on its north face recalls a failed demolition in 1196.',
		blockActions: false,
		shots: [
			{ at: 0.2, position: [-380, 70, 1160], target: [-563, 30, 739], fov: 42 },
			{ at: 0.8, position: [-470, 55, 1060], target: [-563, 30, 739], fov: 42 }
		]
	},
	{
		id: 'building',
		title: 'Building a pyramid',
		summary:
			'Quarries on the plateau, Tura limestone by boat, and the Diary of Merer. How the blocks were raised is still debated: every ramp is a hypothesis.',
		blockActions: false,
		shots: [
			{ at: 0.2, position: [420, 170, 720], target: [0, 50, 0], fov: 42 },
			{ at: 0.8, position: [500, 150, 560], target: [0, 50, 0], fov: 42 }
		]
	},
	{
		id: 'sun-and-shadow',
		title: 'Sun and shadow',
		summary:
			'From 28 February to 13 October the noon sun at Giza stands higher than Khufu’s slope, so the pyramid casts no shadow at midday.',
		blockActions: false,
		shots: [
			{ at: 0.2, position: [250, 220, -720], target: [0, 40, 0], fov: 42 },
			{ at: 0.8, position: [-150, 200, -680], target: [0, 40, 0], fov: 42 }
		]
	},
	{
		id: 'ancient-sky',
		title: 'The sky of 2560 BCE',
		summary:
			'Precession has moved the pole: when the pyramids were built, the star nearest the north celestial pole was Thuban.',
		blockActions: false,
		shots: [
			{ at: 0.2, position: [-500, 16, -650], target: [-80, 300, 300], fov: 60 },
			{ at: 0.8, position: [-420, 14, -560], target: [-80, 320, 300], fov: 60 }
		]
	},
	{
		id: 'then-and-now',
		title: 'Then and now',
		summary:
			'Restore the white Tura limestone casing and the ancient landscape, and compare them with the plateau today.',
		blockActions: false,
		shots: [
			{ at: 0.2, position: [760, 90, 180], target: [-150, 70, 150], fov: 42 },
			{ at: 0.8, position: [680, 80, 60], target: [-150, 70, 150], fov: 42 }
		]
	},
	{
		id: 'explore',
		title: 'Explore',
		summary: 'Move freely around the plateau and take any pyramid apart.',
		blockActions: true,
		shots: [
			{ at: 0.2, position: [950, 520, 950], target: [-250, 40, 380], fov: 42 },
			{ at: 1, position: [900, 480, 1050], target: [-250, 40, 380], fov: 42 }
		]
	}
];

export function resolveCameraKeys(
	chapters: readonly Chapter[],
	groundAt: (x: number, z: number) => number
): CameraKey[] {
	return chapters.flatMap((chapter, index) =>
		chapter.shots.map((shot) => ({
			t: index + shot.at,
			position: [shot.position[0], groundAt(shot.position[0], shot.position[2]) + shot.position[1], shot.position[2]],
			target: [shot.target[0], groundAt(shot.target[0], shot.target[2]) + shot.target[1], shot.target[2]],
			fov: shot.fov
		}))
	);
}

export function chapterIndexAt(t: number, count: number): number {
	return Math.min(Math.max(Math.floor(t), 0), count - 1);
}

export function chapterVisibility(t: number, index: number, count: number): number {
	const local = t - index;
	const fadeIn = index === 0 ? 1 : Math.min(Math.max((local - 0.1) / 0.15, 0), 1);
	const fadeOut = index === count - 1 ? 1 : Math.min(Math.max((0.95 - local) / 0.15, 0), 1);
	return Math.min(fadeIn, fadeOut);
}
