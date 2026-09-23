const PALETTE = [
	// A ordem PRECISA continuar igual à nossa paleta de saída:
	// black, white, yellow, red, blue, green

	{ index: 0, r: 31, g: 34, b: 38 }, // black
	{ index: 1, r: 185, g: 199, b: 201 }, // white
	{ index: 2, r: 193, g: 187, b: 30 }, // yellow
	{ index: 3, r: 98, g: 32, b: 30 }, // red
	{ index: 4, r: 35, g: 63, b: 142 }, // blue
	{ index: 5, r: 53, g: 86, b: 58 }, // green
];

function srgbToLinear(value: number) {
	const c = value / 255;

	if (c <= 0.04045) {
		return c / 12.92;
	}

	return Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToOklab(r: number, g: number, b: number) {
	const lr = srgbToLinear(r);
	const lg = srgbToLinear(g);
	const lb = srgbToLinear(b);

	const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;

	const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;

	const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

	const lRoot = Math.cbrt(l);
	const mRoot = Math.cbrt(m);
	const sRoot = Math.cbrt(s);

	return {
		L: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,

		a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,

		b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
	};
}

const PALETTE_OKLAB = PALETTE.map((color) => ({
	...color,
	...rgbToOklab(color.r, color.g, color.b),
}));

const paletteMinL = Math.min(...PALETTE_OKLAB.map((color) => color.L));

const paletteMaxL = Math.max(...PALETTE_OKLAB.map((color) => color.L));

function findNearest(L: number, a: number, b: number) {
	let best = PALETTE_OKLAB[0];
	let bestDistance = Number.POSITIVE_INFINITY;

	for (const color of PALETTE_OKLAB) {
		const dL = L - color.L;
		const da = a - color.a;
		const db = b - color.b;

		const distance = dL * dL + da * da + db * db;

		if (distance < bestDistance) {
			bestDistance = distance;
			best = color;
		}
	}

	return best;
}

function addError(
	work: Float32Array,
	pixelIndex: number,
	errorL: number,
	errorA: number,
	errorB: number,
	weight: number,
) {
	const i = pixelIndex * 3;

	work[i] += errorL * weight;
	work[i + 1] += errorA * weight;
	work[i + 2] += errorB * weight;
}

export function quantizeFloydSteinbergOklabSerpentine(
	rgba: Uint8Array,
	width: number,
	height: number,
) {
	const pixelCount = width * height;

	const work = new Float32Array(pixelCount * 3);

	const output = new Uint8Array(pixelCount);

	/*
	 * Converte toda a imagem para OKLab.
	 *
	 * A luminosidade também é comprimida
	 * para a faixa que a paleta física
	 * consegue aproximadamente representar.
	 */
	for (let pixel = 0; pixel < pixelCount; pixel++) {
		const source = pixel * 4;

		const lab = rgbToOklab(
			rgba[source],
			rgba[source + 1],
			rgba[source + 2],
		);

		const i = pixel * 3;

		work[i] = paletteMinL + lab.L * (paletteMaxL - paletteMinL);

		work[i + 1] = lab.a;
		work[i + 2] = lab.b;
	}

	for (let y = 0; y < height; y++) {
		const leftToRight = y % 2 === 0;

		const startX = leftToRight ? 0 : width - 1;

		const endX = leftToRight ? width : -1;

		const step = leftToRight ? 1 : -1;

		for (let x = startX; x !== endX; x += step) {
			const pixelIndex = y * width + x;

			const i = pixelIndex * 3;

			const L = work[i];

			const a = work[i + 1];

			const b = work[i + 2];

			const nearest = findNearest(L, a, b);

			output[pixelIndex] = nearest.index;

			const errorL = L - nearest.L;

			const errorA = a - nearest.a;

			const errorB = b - nearest.b;

			/*
			 * Floyd–Steinberg:
			 *
			 *          X   7/16
			 *   3/16 5/16 1/16
			 *
			 * Em linhas ímpares espelhamos
			 * horizontalmente o kernel.
			 */

			if (leftToRight) {
				// direita
				if (x + 1 < width) {
					addError(
						work,
						pixelIndex + 1,
						errorL,
						errorA,
						errorB,
						7 / 16,
					);
				}

				if (y + 1 < height) {
					// inferior esquerda
					if (x > 0) {
						addError(
							work,
							pixelIndex + width - 1,
							errorL,
							errorA,
							errorB,
							3 / 16,
						);
					}

					// inferior
					addError(
						work,
						pixelIndex + width,
						errorL,
						errorA,
						errorB,
						5 / 16,
					);

					// inferior direita
					if (x + 1 < width) {
						addError(
							work,
							pixelIndex + width + 1,
							errorL,
							errorA,
							errorB,
							1 / 16,
						);
					}
				}
			} else {
				// esquerda
				if (x > 0) {
					addError(
						work,
						pixelIndex - 1,
						errorL,
						errorA,
						errorB,
						7 / 16,
					);
				}

				if (y + 1 < height) {
					// inferior direita
					if (x + 1 < width) {
						addError(
							work,
							pixelIndex + width + 1,
							errorL,
							errorA,
							errorB,
							3 / 16,
						);
					}

					// inferior
					addError(
						work,
						pixelIndex + width,
						errorL,
						errorA,
						errorB,
						5 / 16,
					);

					// inferior esquerda
					if (x > 0) {
						addError(
							work,
							pixelIndex + width - 1,
							errorL,
							errorA,
							errorB,
							1 / 16,
						);
					}
				}
			}
		}
	}

	return output;
}
