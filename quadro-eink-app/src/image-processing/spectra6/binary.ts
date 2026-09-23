import { File, Paths } from "expo-file-system";

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
) {
	const expectedPixels = width * height;

	if (paletteIndices.length !== expectedPixels) {
		throw new Error(
			`Quantidade inválida de pixels: ` +
				`${paletteIndices.length}, esperado ${expectedPixels}`,
		);
	}

	/*
	 * 2 pixels por byte.
	 */
	const output = new Uint8Array(Math.ceil(expectedPixels / 2));

	for (let pixel = 0; pixel < expectedPixels; pixel += 2) {
		const firstIndex = paletteIndices[pixel];

		const secondIndex =
			pixel + 1 < expectedPixels ? paletteIndices[pixel + 1] : 1; // branco se sobrar pixel ímpar

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
