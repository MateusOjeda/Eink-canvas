import { File, Paths } from "expo-file-system";
import type { DisplayOrientation } from "@/types/display";

/*
 * Índice retornado pelos algoritmos:
 *
 * 0 = black
 * 1 = white
 * 2 = yellow
 * 3 = red
 * 4 = blue
 * 5 = green
 *
 * Código nativo Spectra 6:
 *
 * black  = 0x0
 * white  = 0x1
 * yellow = 0x2
 * red    = 0x3
 * blue   = 0x5
 * green  = 0x6
 */
const HARDWARE_CODES = [0x0, 0x1, 0x2, 0x3, 0x5, 0x6] as const;

export function saveSpectra6Binary(
	paletteIndices: Uint8Array,
	width: number,
	height: number,
	prefix: string,
	orientation: DisplayOrientation,
) {
	const expectedPixels = width * height;

	if (paletteIndices.length !== expectedPixels) {
		throw new Error(
			`Quantidade inválida de pixels: ` +
				`${paletteIndices.length}, esperado ${expectedPixels}`,
		);
	}

	/*
	 * Paisagem: mantém a ordem original.
	 * Retrato: percorre os pixels por coluna.
	 */
	const orderedPixels = new Uint8Array(expectedPixels);

	if (orientation === "portrait") {
		let index = 0;

		for (let x = width - 1; x >= 0; x--) {
			for (let y = 0; y < height; y++) {
				orderedPixels[index++] = paletteIndices[y * width + x];
			}
		}
	} else {
		for (let i = 0; i < paletteIndices.length; i++) {
			orderedPixels[i] = paletteIndices[paletteIndices.length - 1 - i];
		}
	}

	/*
	 * Empacota dois pixels por byte:
	 * primeiro pixel no nibble alto;
	 * segundo pixel no nibble baixo.
	 */
	const output = new Uint8Array(Math.ceil(expectedPixels / 2));

	for (let pixel = 0; pixel < expectedPixels; pixel += 2) {
		const firstIndex = orderedPixels[pixel];

		const secondIndex =
			pixel + 1 < expectedPixels ? orderedPixels[pixel + 1] : 1;

		const firstCode = HARDWARE_CODES[firstIndex];
		const secondCode = HARDWARE_CODES[secondIndex];

		if (firstCode === undefined || secondCode === undefined) {
			throw new Error("Índice de cor Spectra 6 inválido.");
		}

		output[pixel >> 1] = (firstCode << 4) | secondCode;
	}

	const outputFile = new File(
		Paths.cache,
		`${prefix}-${width}x${height}-${Date.now()}.bin`,
	);

	outputFile.write(output);

	return outputFile.uri;
}
