import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { ANCIENT_SKY, starAt } from '../src/lib/data/sky.ts';

const INPUT = resolve(import.meta.dirname, '../assets-src/stars/bsc5.dat.gz');
const OUTPUT = resolve(import.meta.dirname, '../src/lib/data/stars-ancient.ts');
const HOUR = Math.PI / 12;
const DEGREE = Math.PI / 180;

const field = (line: string, from: number, to: number) => line.slice(from - 1, to).trim();
const number = (line: string, from: number, to: number) => Number.parseFloat(field(line, from, to));

const { year, limitingMagnitude } = ANCIENT_SKY.value;
const lines = gunzipSync(await readFile(INPUT))
	.toString('latin1')
	.split('\n');
const values: number[] = [];
let count = 0;

for (const line of lines) {
	if (line.length < 160 || field(line, 76, 77) === '') continue;
	const magnitude = number(line, 103, 107);
	if (!(magnitude <= limitingMagnitude)) continue;
	const ra = (number(line, 76, 77) + number(line, 78, 79) / 60 + number(line, 80, 83) / 3600) * HOUR;
	const sign = field(line, 84, 84) === '-' ? -1 : 1;
	const dec = sign * (number(line, 85, 86) + number(line, 87, 88) / 60 + number(line, 89, 90) / 3600) * DEGREE;
	const pmRa = number(line, 149, 154) || 0;
	const pmDec = number(line, 155, 160) || 0;
	const colorIndex = number(line, 110, 114);
	const [ancientRa, ancientDec] = starAt(ra, dec, pmRa, pmDec, year);
	values.push(
		Number(ancientRa.toFixed(5)),
		Number(ancientDec.toFixed(5)),
		magnitude,
		Number.isFinite(colorIndex) ? colorIndex : 0.6
	);
	count++;
}

const rows: string[] = [];
for (let i = 0; i < values.length; i += 16) rows.push(`\t${values.slice(i, i + 16).join(', ')},`);

await writeFile(
	OUTPUT,
	`export const STAR_STRIDE = 4;\n\nexport const ANCIENT_STARS = new Float32Array([\n${rows.join('\n')}\n]);\n`
);
console.log(`Wrote ${count} stars brighter than magnitude ${limitingMagnitude} for year ${year} to ${OUTPUT}`);
