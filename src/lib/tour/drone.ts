import type { CameraPose, Vec3 } from './track.ts';

const START_BEARING_DEG = 72;
const TURN_DEG_PER_SECOND = 0.55;
const APPROACH_SECONDS = 16;
const FAR_RADIUS = 980;
const NEAR_RADIUS = 470;
const FAR_HEIGHT = 300;
const NEAR_HEIGHT = 165;
const SWAY_HEIGHT = 18;
const SWAY_SECONDS = 23;
const LOOK_HEIGHT = 20;
const LEAD_DEG = 6;
const FOV = 50;
const DEG = Math.PI / 180;

export function dronePose(seconds: number, center: Vec3, out: CameraPose): CameraPose {
	const approach = Math.exp(-seconds / APPROACH_SECONDS);
	const bearing = (START_BEARING_DEG + TURN_DEG_PER_SECOND * seconds) * DEG;
	const radius = NEAR_RADIUS + (FAR_RADIUS - NEAR_RADIUS) * approach;
	const height =
		NEAR_HEIGHT +
		(FAR_HEIGHT - NEAR_HEIGHT) * approach +
		Math.sin((seconds / SWAY_SECONDS) * Math.PI * 2) * SWAY_HEIGHT;
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
