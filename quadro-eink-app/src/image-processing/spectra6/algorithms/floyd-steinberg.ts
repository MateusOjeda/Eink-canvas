import { findNearestPaletteIndex, SPECTRA6_PALETTE } from "../palette";

function clampColor(value: number) {
	return Math.max(0, Math.min(255, value));
}

export function quantizeFloydSteinberg(
	rgba: Uint8Array,
	width: number,
	height: number,
) {
	const pixelCount = width * height;

	/*
	 * Buffer RGB em ponto flutuante.
	 *
	 * Precisamos dele porque o erro propagado
	 * pode produzir valores fracionários.
	 */
	const work = new Float32Array(pixelCount * 3);

	const output = new Uint8Array(pixelCount);

	/*
	 * RGBA -> RGB float.
	 */
	for (let pixel = 0; pixel < pixelCount; pixel++) {
		const sourceIndex = pixel * 4;
		const workIndex = pixel * 3;

		work[workIndex] = rgba[sourceIndex];

		work[workIndex + 1] = rgba[sourceIndex + 1];

		work[workIndex + 2] = rgba[sourceIndex + 2];
	}

	const rowStride = width * 3;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const pixelIndex = y * width + x;

			const i = pixelIndex * 3;

			const r = clampColor(work[i]);

			const g = clampColor(work[i + 1]);

			const b = clampColor(work[i + 2]);

			const paletteIndex = findNearestPaletteIndex(r, g, b);

			output[pixelIndex] = paletteIndex;

			const color = SPECTRA6_PALETTE[paletteIndex];

			/*
			 * Erro de quantização.
			 */
			const errorR = r - color.r;

			const errorG = g - color.g;

			const errorB = b - color.b;

			/*
			 *         X   7/16
			 *  3/16 5/16 1/16
			 */

			// Direita
			if (x + 1 < width) {
				const n = i + 3;

				work[n] += errorR * (7 / 16);

				work[n + 1] += errorG * (7 / 16);

				work[n + 2] += errorB * (7 / 16);
			}

			if (y + 1 < height) {
				// Inferior esquerdo
				if (x > 0) {
					const n = i + rowStride - 3;

					work[n] += errorR * (3 / 16);

					work[n + 1] += errorG * (3 / 16);

					work[n + 2] += errorB * (3 / 16);
				}

				// Inferior
				{
					const n = i + rowStride;

					work[n] += errorR * (5 / 16);

					work[n + 1] += errorG * (5 / 16);

					work[n + 2] += errorB * (5 / 16);
				}

				// Inferior direito
				if (x + 1 < width) {
					const n = i + rowStride + 3;

					work[n] += errorR * (1 / 16);

					work[n + 1] += errorG * (1 / 16);

					work[n + 2] += errorB * (1 / 16);
				}
			}
		}
	}

	return output;
}
