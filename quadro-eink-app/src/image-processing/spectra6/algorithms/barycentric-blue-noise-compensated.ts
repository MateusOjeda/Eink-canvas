const BLACK = 0;
const WHITE = 1;
const YELLOW = 2;
const RED = 3;
const BLUE = 4;
const GREEN = 5;

const BLUE_NOISE_RANK_16 = new Uint8Array([
	84, 143, 96, 232, 85, 203, 91, 207, 117, 137, 119, 249, 127, 163, 126, 140,
	165, 22, 142, 49, 178, 27, 244, 60, 185, 23, 218, 44, 129, 20, 217, 57, 80,
	153, 108, 173, 112, 164, 82, 190, 78, 233, 107, 175, 104, 197, 65, 214, 172,
	39, 167, 3, 255, 50, 224, 8, 149, 37, 133, 1, 158, 58, 179, 13,

	101, 132, 98, 240, 93, 248, 113, 177, 109, 187, 88, 251, 123, 195, 74, 226,
	150, 29, 204, 47, 242, 17, 215, 56, 191, 28, 235, 51, 222, 21, 213, 61, 115,
	160, 118, 200, 95, 211, 90, 176, 122, 130, 64, 168, 72, 145, 121, 139, 152,
	40, 198, 15, 136, 59, 237, 4, 236, 52, 166, 9, 169, 42, 141, 6,

	103, 182, 94, 151, 120, 243, 81, 250, 97, 254, 75, 202, 125, 144, 89, 219,
	205, 24, 212, 38, 134, 19, 231, 33, 220, 31, 208, 48, 155, 26, 131, 55, 110,
	162, 92, 228, 70, 138, 111, 252, 69, 157, 124, 174, 77, 216, 68, 209, 245,
	35, 171, 0, 223, 45, 184, 11, 241, 43, 147, 2, 170, 41, 230, 12,

	99, 135, 76, 194, 102, 253, 100, 229, 105, 154, 114, 192, 87, 199, 67, 188,
	206, 18, 196, 32, 210, 30, 201, 46, 146, 16, 234, 54, 186, 25, 239, 63, 116,
	159, 71, 183, 73, 225, 66, 148, 79, 181, 83, 246, 106, 227, 86, 128, 189,
	62, 180, 10, 221, 34, 247, 5, 238, 53, 156, 14, 193, 36, 161, 7,
]);

function clamp01(value: number) {
	return Math.max(0, Math.min(1, value));
}

/*
 * Compensação experimental para o gamut/aparência
 * do Spectra 6 físico.
 *
 * Ideia:
 * 1. compensar black/white point da paleta medida;
 * 2. dar um pequeno ganho de saturação;
 * 3. levantar um pouco canais mais "fracos".
 */
function compensateRgbForSpectra6(r: number, g: number, b: number) {
	// Black / white points aproximados da preview palette
	const blackR = 31 / 255;
	const blackG = 34 / 255;
	const blackB = 38 / 255;

	const whiteR = 185 / 255;
	const whiteG = 199 / 255;
	const whiteB = 201 / 255;

	// Normaliza considerando preto e branco físicos
	r = (r - blackR) / (whiteR - blackR);
	g = (g - blackG) / (whiteG - blackG);
	b = (b - blackB) / (whiteB - blackB);

	r = clamp01(r);
	g = clamp01(g);
	b = clamp01(b);

	// Leve levantamento de médios
	r = Math.pow(r, 0.92);
	g = Math.pow(g, 0.92);
	b = Math.pow(b, 0.92);

	// Ganhos por canal (experimental)
	r *= 1.06;
	g *= 1.1;
	b *= 1.14;

	// Boost de saturação
	const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

	const saturationBoost = 1.22;

	r = luma + (r - luma) * saturationBoost;
	g = luma + (g - luma) * saturationBoost;
	b = luma + (b - luma) * saturationBoost;

	return {
		r: clamp01(r),
		g: clamp01(g),
		b: clamp01(b),
	};
}

function projectIntoSpectraGamut(r: number, g: number, b: number) {
	if (r >= g) {
		const excess = r - g + b - 1;

		if (excess > 0) {
			const delta = excess / 3;

			r -= delta;
			g += delta;
			b -= delta;
		}
	} else {
		const excess = g - r + b - 1;

		if (excess > 0) {
			const delta = excess / 3;

			r += delta;
			g -= delta;
			b -= delta;
		}
	}

	return {
		r: clamp01(r),
		g: clamp01(g),
		b: clamp01(b),
	};
}

function blueNoiseThreshold(x: number, y: number) {
	const tileX = x >> 4;
	const tileY = y >> 4;

	const shiftX = (tileX * 5 + tileY * 3) & 15;

	const shiftY = (tileX * 7 + tileY * 11) & 15;

	const localX = ((x & 15) + shiftX) & 15;

	const localY = ((y & 15) + shiftY) & 15;

	const rank = BLUE_NOISE_RANK_16[localY * 16 + localX];

	return (rank + 0.5) / 256;
}

function pickColor(
	threshold: number,

	color0: number,
	weight0: number,

	color1: number,
	weight1: number,

	color2: number,
	weight2: number,

	color3: number,
) {
	let cumulative = weight0;

	if (threshold < cumulative) {
		return color0;
	}

	cumulative += weight1;

	if (threshold < cumulative) {
		return color1;
	}

	cumulative += weight2;

	if (threshold < cumulative) {
		return color2;
	}

	return color3;
}

export function quantizeBarycentricBlueNoiseCompensated(
	rgba: Uint8Array,
	width: number,
	height: number,
) {
	const output = new Uint8Array(width * height);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const pixel = y * width + x;
			const source = pixel * 4;

			let r = rgba[source] / 255;
			let g = rgba[source + 1] / 255;
			let b = rgba[source + 2] / 255;

			// NOVO: compensação antes da decomposição
			const compensated = compensateRgbForSpectra6(r, g, b);

			r = compensated.r;
			g = compensated.g;
			b = compensated.b;

			const projected = projectIntoSpectraGamut(r, g, b);

			r = projected.r;
			g = projected.g;
			b = projected.b;

			const threshold = blueNoiseThreshold(x, y);

			if (r >= g) {
				if (b + r <= 1) {
					output[pixel] = pickColor(
						threshold,

						BLUE,
						b,

						YELLOW,
						g,

						RED,
						r - g,

						BLACK,
					);
				} else {
					const blueWeight = 1 - r;

					const yellowWeight = 1 + g - r - b;

					const redWeight = r - g;

					output[pixel] = pickColor(
						threshold,

						BLUE,
						blueWeight,

						YELLOW,
						yellowWeight,

						RED,
						redWeight,

						WHITE,
					);
				}
			} else {
				if (b + g <= 1) {
					output[pixel] = pickColor(
						threshold,

						BLUE,
						b,

						GREEN,
						g - r,

						YELLOW,
						r,

						BLACK,
					);
				} else {
					const blueWeight = 1 - g;

					const greenWeight = g - r;

					const yellowWeight = 1 + r - g - b;

					output[pixel] = pickColor(
						threshold,

						BLUE,
						blueWeight,

						GREEN,
						greenWeight,

						YELLOW,
						yellowWeight,

						WHITE,
					);
				}
			}
		}
	}

	return output;
}
