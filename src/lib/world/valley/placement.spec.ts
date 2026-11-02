import { describe, expect, it } from 'vitest';
import { canalCenter, valleyPlants } from './placement.ts';

describe('valley placement', () => {
	it('places greenery only east of the plateau and consistently for the same seed', () => {
		const plants = valleyPlants(400, 2589);
		expect(plants).toEqual(valleyPlants(400, 2589));
		expect(plants.every((plant) => plant.x > 900 && plant.x < 3500 && plant.scale > 0)).toBe(true);
		expect(plants.filter((plant) => plant.x < 2050)).toHaveLength(340);
		expect(canalCenter(620)).toBe(-135);
		expect(canalCenter(3340)).toBe(305);
	});
});
