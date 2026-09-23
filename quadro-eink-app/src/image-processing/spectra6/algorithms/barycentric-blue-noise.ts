/*
 * Barycentric + Blue Noise
 *
 * Spectra 6 logical palette:
 *
 * 0 = black
 * 1 = white
 * 2 = yellow
 * 3 = red
 * 4 = blue
 * 5 = green
 *
 * A decomposição usa as cores lógicas ideais,
 * porque elas formam o octaedro RGB.
 *
 * A aparência física/calibrada das cores continua
 * sendo responsabilidade da preview em image.ts.
 */

const BLACK = 0;
const WHITE = 1;
const YELLOW = 2;
const RED = 3;
const BLUE = 4;
const GREEN = 5;

/*
 * Máscara de ranks 16×16 gerada especificamente
 * para este projeto usando distribuição progressiva
 * de pontos afastados.
 *
 * 0 = menor threshold
 * 255 = maior threshold
 *
 * Não é copiada do epd-dither.
 */
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
 * Algumas cores RGB ficam fora do volume que
 * essas seis cores conseguem representar.
 *
 * Exemplo clássico:
 *   magenta / cyan.
 *
 * O gamut lógico Spectra 6 obedece:
 *
 *   b <= 1 - |r - g|
 *
 * Quando um pixel cai fora, projetamos para
 * a face mais próxima do octaedro.
 */
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

/*
 * O tile é deslocado entre blocos para reduzir
 * a percepção da repetição 16×16.
 */
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

/*
 * Escolhe uma das quatro cores da decomposição
 * usando as probabilidades barycentric.
 */
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

export function quantizeBarycentricBlueNoise(
	rgba: Uint8Array,
	width: number,
	height: number,
) {
	const output = new Uint8Array(width * height);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const pixel = y * width + x;

			const source = pixel * 4;

			/*
			 * RGB lógico normalizado.
			 */
			let r = rgba[source] / 255;

			let g = rgba[source + 1] / 255;

			let b = rgba[source + 2] / 255;

			/*
			 * Coloca cores impossíveis
			 * dentro do gamut do octaedro.
			 */
			const projected = projectIntoSpectraGamut(r, g, b);

			r = projected.r;
			g = projected.g;
			b = projected.b;

			const threshold = blueNoiseThreshold(x, y);

			/*
			 * O octaedro pode ser dividido
			 * em quatro tetraedros.
			 *
			 * A região é determinada por:
			 *
			 *   r >= g ou g > r
			 *
			 * e por:
			 *
			 *   b + max(r,g) <= 1
			 *
			 * ou > 1.
			 */

			if (r >= g) {
				if (b + r <= 1) {
					/*
					 * Tetraedro:
					 *
					 * BLUE
					 * YELLOW
					 * RED
					 * BLACK
					 *
					 * Pesos:
					 *
					 * B = b
					 * Y = g
					 * R = r - g
					 * K = 1 - b - r
					 */

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
					/*
					 * Tetraedro:
					 *
					 * BLUE
					 * YELLOW
					 * RED
					 * WHITE
					 */

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
					/*
					 * Tetraedro:
					 *
					 * BLUE
					 * GREEN
					 * YELLOW
					 * BLACK
					 */

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
					/*
					 * Tetraedro:
					 *
					 * BLUE
					 * GREEN
					 * YELLOW
					 * WHITE
					 */

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
