import { quantizeFloydSteinberg } from "./algorithms/floyd-steinberg";

import { quantizeFloydSteinbergOklabSerpentine } from "./algorithms/floyd-steinberg-oklab-serpentine";

import { quantizeNearest } from "./algorithms/nearest";

import { loadImageRgba, savePalettePreview } from "./image";

import { Spectra6Quantizer, Spectra6Algorithm } from "./types";

async function processSpectra6(
	uri: string,
	quantizer: Spectra6Quantizer,
	algorithmName: string,
	prefix: string,
) {
	const totalStart = Date.now();

	const { pixels, width, height } = await loadImageRgba(uri);

	const quantizeStart = Date.now();

	const paletteIndices = quantizer(pixels, width, height);

	const quantizeMs = Date.now() - quantizeStart;

	const result = savePalettePreview(paletteIndices, width, height, prefix);

	const totalMs = Date.now() - totalStart;

	console.log(`[Spectra6] ${algorithmName}`, {
		width,
		height,
		quantizeMs,
		totalMs,
	});

	return result;
}

export function convertToSpectra6Nearest(uri: string) {
	return processSpectra6(uri, quantizeNearest, "nearest", "spectra6-nearest");
}

export function convertToSpectra6FloydSteinberg(uri: string) {
	return processSpectra6(
		uri,
		quantizeFloydSteinberg,
		"floyd-steinberg",
		"spectra6-floyd",
	);
}

export function convertToSpectra6FloydSteinbergOklabSerpentine(uri: string) {
	return processSpectra6(
		uri,
		quantizeFloydSteinbergOklabSerpentine,
		"floyd-steinberg-oklab-serpentine",
		"spectra6-floyd-oklab-serpentine",
	);
}

export function convertToSpectra6(uri: string, algorithm: Spectra6Algorithm) {
	switch (algorithm) {
		case "nearest-rgb":
			return convertToSpectra6Nearest(uri);

		case "floyd-steinberg-rgb":
			return convertToSpectra6FloydSteinberg(uri);

		case "floyd-steinberg-oklab-serpentine":
			return convertToSpectra6FloydSteinbergOklabSerpentine(uri);
	}
}
