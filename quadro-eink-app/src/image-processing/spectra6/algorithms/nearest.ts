import { findNearestPaletteIndex } from "../palette";

export function quantizeNearest(
	rgba: Uint8Array,
	width: number,
	height: number,
) {
	const pixelCount = width * height;

	const output = new Uint8Array(pixelCount);

	for (let pixel = 0; pixel < pixelCount; pixel++) {
		const sourceIndex = pixel * 4;

		output[pixel] = findNearestPaletteIndex(
			rgba[sourceIndex],
			rgba[sourceIndex + 1],
			rgba[sourceIndex + 2],
		);
	}

	return output;
}
