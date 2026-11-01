import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { chromium } from 'playwright';

interface ImageReference {
	id: string;
	file: string;
	regions: Record<string, [number, number, number, number]>;
}

const manifestPath = resolve(process.argv[2] ?? 'assets-src/references/lighting/references.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { images: ImageReference[] };
const browser = await chromium.launch({ headless: true });
try {
	const page = await browser.newPage();
	const measurements = [];
	for (const reference of manifest.images) {
		const bytes = await readFile(resolve(dirname(manifestPath), reference.file));
		const mime = extname(reference.file).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
		const samples = await page.evaluate(
			async ({ data, regions }) => {
				const image = new Image();
				image.src = data;
				await image.decode();
				const canvas = document.createElement('canvas');
				canvas.width = image.naturalWidth;
				canvas.height = image.naturalHeight;
				const context = canvas.getContext('2d', { willReadFrequently: true });
				if (!context) throw new Error('A 2D canvas is required to measure colors');
				context.drawImage(image, 0, 0);
				const results: Record<string, unknown> = {};
				const linear = (channel: number) => {
					const s = channel / 255;
					return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
				};
				for (const [name, [x, y, w, h]] of Object.entries(regions)) {
					if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1 || y + h > 1) throw new Error(`Invalid region: ${name}`);
					const pixels = context.getImageData(
						Math.floor(x * canvas.width),
						Math.floor(y * canvas.height),
						Math.max(1, Math.floor(w * canvas.width)),
						Math.max(1, Math.floor(h * canvas.height))
					).data;
					const channels: number[][] = [[], [], []];
					const luminance: number[] = [];
					const stride = Math.max(1, Math.floor(pixels.length / 4 / 16384)) * 4;
					for (let i = 0; i < pixels.length; i += stride) {
						for (let c = 0; c < 3; c++) channels[c].push(pixels[i + c]);
						luminance.push(
							0.2126 * linear(pixels[i]) + 0.7152 * linear(pixels[i + 1]) + 0.0722 * linear(pixels[i + 2])
						);
					}
					for (const values of [...channels, luminance]) values.sort((a, b) => a - b);
					const quantile = (values: number[], q: number) =>
						Number(values[Math.floor((values.length - 1) * q)].toFixed(5));
					const median = channels.map((values) => quantile(values, 0.5));
					results[name] = {
						medianSrgb: median,
						hex: `#${median.map((value) => value.toString(16).padStart(2, '0')).join('')}`,
						luminance: { p10: quantile(luminance, 0.1), p50: quantile(luminance, 0.5), p90: quantile(luminance, 0.9) }
					};
				}
				return { width: canvas.width, height: canvas.height, regions: results };
			},
			{ data: `data:${mime};base64,${bytes.toString('base64')}`, regions: reference.regions }
		);
		measurements.push({ id: reference.id, sha256: createHash('sha256').update(bytes).digest('hex'), ...samples });
	}
	const output = resolve(dirname(manifestPath), 'palette.json');
	await writeFile(
		output,
		`${JSON.stringify({ method: 'Browser sRGB decode; per-channel medians; linear sRGB luminance quantiles; no image files modified.', measurements }, null, 2)}\n`
	);
	console.log(output);
} finally {
	await browser.close();
}
