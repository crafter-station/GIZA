import type { CameraPose, Vec3 } from './track.ts';

const START_BEARING_DEG = 72;
const TURN_DEG_PER_SECOND = 1.1;
const APPROACH_SECONDS = 14;
const FAR_RADIUS = 980;
const CRUISE_RADIUS = 560;
const RADIUS_SWING = 150;
const RADIUS_PERIOD_SECONDS = 75;
const FAR_HEIGHT = 300;
const CRUISE_HEIGHT = 190;
const HEIGHT_SWING = 55;
const HEIGHT_PERIOD_SECONDS = 53;
const LOOK_HEIGHT = 20;
const LEAD_DEG = 6;
const FOV = 50;
const DEG = Math.PI / 180;

function swing(seconds: number, period: number, phase: number): number {
	return Math.sin((seconds / period) * Math.PI * 2 + phase);
}

export function dronePose(seconds: number, center: Vec3, out: CameraPose): CameraPose {
	const approach = Math.exp(-seconds / APPROACH_SECONDS);
	const cruise = 1 - approach;
	const bearing = (START_BEARING_DEG + TURN_DEG_PER_SECOND * seconds) * DEG;
	const radius =
		CRUISE_RADIUS +
		(FAR_RADIUS - CRUISE_RADIUS) * approach +
		RADIUS_SWING * cruise * swing(seconds, RADIUS_PERIOD_SECONDS, -Math.PI / 2);
	const height =
		CRUISE_HEIGHT +
		(FAR_HEIGHT - CRUISE_HEIGHT) * approach +
		HEIGHT_SWING * cruise * swing(seconds, HEIGHT_PERIOD_SECONDS, Math.PI / 3);
	const lead = bearing + LEAD_DEG * DEG;
	out.position = [center[0] + Math.sin(bearing) * radius, center[1] + height, center[2] - Math.cos(bearing) * radius];
	out.target = [
		center[0] - Math.sin(lead) * radius * 0.12,
		center[1] + LOOK_HEIGHT,
		center[2] + Math.cos(lead) * radius * 0.12
	];
	out.fov = FOV;
	return out;
}
