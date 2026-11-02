export const TIERS = ['low', 'medium', 'high', 'ultra'] as const;

export type Tier = (typeof TIERS)[number];

export type Backend = 'webgpu' | 'webgl2';

export interface TierSettings {
	blockTarget: number;
	maxPixelRatio: number;
	rockCount: number;
	pyramidDetail: number;
	physicsBodies: number;
	dustMotes: number;
	jointDust: number;
	torchLights: number;
}

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
	low: {
		blockTarget: 12_000,
		maxPixelRatio: 1,
		rockCount: 350,
		pyramidDetail: 0.25,
		physicsBodies: 400,
		dustMotes: 1500,
		jointDust: 1500,
		torchLights: 0
	},
	medium: {
		blockTarget: 30_000,
		maxPixelRatio: 1.25,
		rockCount: 900,
		pyramidDetail: 0.5,
		physicsBodies: 1000,
		dustMotes: 4000,
		jointDust: 4000,
		torchLights: 2
	},
	high: {
		blockTarget: 70_000,
		maxPixelRatio: 1.5,
		rockCount: 1600,
		pyramidDetail: 0.8,
		physicsBodies: 2000,
		dustMotes: 8000,
		jointDust: 8000,
		torchLights: 4
	},
	ultra: {
		blockTarget: 140_000,
		maxPixelRatio: 2,
		rockCount: 2400,
		pyramidDetail: 1,
		physicsBodies: 3000,
		dustMotes: 12000,
		jointDust: 12000,
		torchLights: 4
	}
};

export function isTier(value: string | null): value is Tier {
	return TIERS.includes(value as Tier);
}

export function maxTierFor(backend: Backend): Tier {
	return backend === 'webgpu' ? 'ultra' : 'medium';
}

export function clampTier(tier: Tier, backend: Backend): Tier {
	return TIERS[Math.min(TIERS.indexOf(tier), TIERS.indexOf(maxTierFor(backend)))];
}

export function initialTier(backend: Backend, coarsePointer: boolean): Tier {
	return clampTier(coarsePointer ? 'medium' : 'ultra', backend);
}

export function lowerTier(tier: Tier): Tier | null {
	const index = TIERS.indexOf(tier);
	return index > 0 ? TIERS[index - 1] : null;
}

export function tierAfterBenchmark(tier: Tier, medianFrameMs: number): Tier | null {
	return medianFrameMs > 22 ? lowerTier(tier) : null;
}
