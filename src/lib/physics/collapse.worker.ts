import RAPIER from '@dimforge/rapier3d-simd-compat';
import { BODY_STRIDE, type CollapseMessage, type CollapseStart, STATE_STRIDE } from './protocol.ts';

const STEP = 1 / 60;
const SPILL_SPEED = 7;

function outward(x: number, z: number): [number, number, number] {
	const length = Math.hypot(x, z) || 1;
	return [
		(x / length) * SPILL_SPEED + (Math.random() - 0.5) * 2,
		Math.random() * 2,
		(z / length) * SPILL_SPEED + (Math.random() - 0.5) * 2
	];
}
let world: RAPIER.World | null = null;
let handles: RAPIER.RigidBody[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

function stop(): void {
	if (timer) clearInterval(timer);
	timer = null;
	world?.free();
	world = null;
	handles = [];
}

async function start({ bodies, ground }: CollapseStart): Promise<void> {
	stop();
	await RAPIER.init();
	world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
	world.createCollider(
		RAPIER.ColliderDesc.cuboid(4000, 10, 4000)
			.setTranslation(0, ground - 10, 0)
			.setFriction(0.9)
	);
	const count = bodies.length / BODY_STRIDE;
	for (let i = 0; i < count; i++) {
		const o = i * BODY_STRIDE;
		const body = world.createRigidBody(
			RAPIER.RigidBodyDesc.dynamic()
				.setTranslation(bodies[o], bodies[o + 1], bodies[o + 2])
				.setRotation({ x: bodies[o + 6], y: bodies[o + 7], z: bodies[o + 8], w: bodies[o + 9] })
				.setLinvel(...outward(bodies[o], bodies[o + 2]))
				.setAngvel({ x: (Math.random() - 0.5) * 0.6, y: (Math.random() - 0.5) * 0.6, z: (Math.random() - 0.5) * 0.6 })
		);
		world.createCollider(
			RAPIER.ColliderDesc.cuboid(bodies[o + 3] / 2, bodies[o + 4] / 2, bodies[o + 5] / 2)
				.setDensity(2.3)
				.setFriction(0.8)
				.setRestitution(0.05),
			body
		);
		handles.push(body);
	}
	const state = new Float32Array(count * STATE_STRIDE);
	timer = setInterval(() => {
		if (!world) return;
		world.timestep = STEP;
		world.step();
		handles.forEach((body, i) => {
			const p = body.translation();
			const q = body.rotation();
			state.set([p.x, p.y, p.z, 1, q.x, q.y, q.z, q.w], i * STATE_STRIDE);
		});
		const copy = state.slice();
		self.postMessage(copy, { transfer: [copy.buffer] });
	}, STEP * 1000);
}

self.onmessage = (event: MessageEvent<CollapseMessage>) => {
	if (event.data.type === 'start') void start(event.data);
	else stop();
};
