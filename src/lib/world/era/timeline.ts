export function tourEra(t: number): number {
	if (!Number.isFinite(t) || t <= 9.08) return 0;
	if (t >= 10.18) return 0;
	if (t >= 9.92) return 1 - smooth((t - 9.92) / 0.26);
	return smooth((t - 9.08) / 0.84);
}

function smooth(value: number): number {
	const x = Math.max(0, Math.min(1, value));
	return x * x * (3 - 2 * x);
}
