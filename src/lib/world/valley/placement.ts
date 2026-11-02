export interface PlantSite {
	x: number;
	z: number;
	scale: number;
}

export function valleyPlants(count: number, seed = 1719): PlantSite[] {
	let state = seed >>> 0;
	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
	return Array.from({ length: count }, (_, index) => {
		const foreground = index < count * 0.65;
		const middle = index < count * 0.85;
		return {
			x: foreground ? 930 + next() * 550 : middle ? 1150 + next() * 900 : 2050 + next() * 1350,
			z: foreground ? -50 + next() * 450 : middle ? -650 + next() * 2150 : -1500 + next() * 6100,
			scale: 0.7 + next() * 0.7
		};
	});
}

export function canalCenter(x: number): number {
	const t = Math.max(0, Math.min(1, (x - 620) / 2720));
	return -135 + t * 440 + Math.sin(t * Math.PI) * 80;
}
