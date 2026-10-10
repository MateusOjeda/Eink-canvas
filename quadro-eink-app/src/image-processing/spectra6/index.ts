import type { DisplayOrientation } from "@/types/display";

import { quantizeFloydSteinberg } from "./algorithms/floyd-steinberg";
import { quantizeFloydSteinbergOklabSerpentine } from "./algorithms/floyd-steinberg-oklab-serpentine";
import { quantizeBarycentricBlueNoiseCompensated } from "./algorithms/barycentric-blue-noise-compensated";
import { quantizeBarycentricBlueNoise } from "./algorithms/barycentric-blue-noise";
import { convertToSpectra6GoodDisplayFloydSteinberg } from "./algorithms/good-display-floyd-steinberg";
import { quantizeNearest } from "./algorithms/nearest";

import { loadImageRgba, savePalettePreview, adjustImageRgba } from "./image";

import type { Spectra6Quantizer, Spectra6Algorithm } from "./types";

import { saveSpectra6Binary } from "./binary";

async function processSpectra6(
	uri: string,
	quantizer: Spectra6Quantizer,
	algorithmName: string,
	prefix: string,
	orientation: DisplayOrientation,
	brightness: number,
	saturation: number,
) {
	const totalStart = Date.now();

	const { pixels: originalPixels, width, height } = await loadImageRgba(uri);

	const pixels = adjustImageRgba(originalPixels, brightness, saturation);

	const quantizeStart = Date.now();

	const paletteIndices = quantizer(pixels, width, height);

	const binUri = saveSpectra6Binary(
		paletteIndices,
		width,
		height,
		prefix,
		orientation,
	);

	const preview = savePalettePreview(paletteIndices, width, height, prefix);

	const quantizeMs = Date.now() - quantizeStart;
	const totalMs = Date.now() - totalStart;

	console.log(`[Spectra6] ${algorithmName}`, {
		width,
		height,
		orientation,
		quantizeMs,
		totalMs,
	});

	return {
		uri: preview.uri,
		binUri,
		width,
		height,
	};
}

function convertToSpectra6Nearest(
	uri: string,
	orientation: DisplayOrientation,
	brightness: number,
	saturation: number,
) {
	return processSpectra6(
		uri,
		quantizeNearest,
		"nearest",
		"spectra6-nearest",
		orientation,
		brightness,
		saturation,
	);
}

function convertToSpectra6FloydSteinberg(
	uri: string,
	orientation: DisplayOrientation,
	brightness: number,
	saturation: number,
) {
	return processSpectra6(
		uri,
		quantizeFloydSteinberg,
		"floyd-steinberg",
		"spectra6-floyd",
		orientation,
		brightness,
		saturation,
	);
}

function convertToSpectra6FloydSteinbergOklabSerpentine(
	uri: string,
	orientation: DisplayOrientation,
	brightness: number,
	saturation: number,
) {
	return processSpectra6(
		uri,
		quantizeFloydSteinbergOklabSerpentine,
		"floyd-steinberg-oklab-serpentine",
		"spectra6-floyd-oklab-serpentine",
		orientation,
		brightness,
		saturation,
	);
}

function convertToSpectra6BarycentricBlueNoise(
	uri: string,
	orientation: DisplayOrientation,
	brightness: number,
	saturation: number,
) {
	return processSpectra6(
		uri,
		quantizeBarycentricBlueNoise,
		"barycentric-blue-noise",
		"spectra6-barycentric-blue-noise",
		orientation,
		brightness,
		saturation,
	);
}

function convertToSpectra6BarycentricBlueNoiseCompensated(
	uri: string,
	orientation: DisplayOrientation,
	brightness: number,
	saturation: number,
) {
	return processSpectra6(
		uri,
		quantizeBarycentricBlueNoiseCompensated,
		"barycentric-blue-noise-compensated",
		"spectra6-barycentric-blue-noise-compensated",
		orientation,
		brightness,
		saturation,
	);
}

export function convertToSpectra6(
	uri: string,
	algorithm: Spectra6Algorithm,
	orientation: DisplayOrientation,
	brightness = 0,
	saturation = 100,
) {
	switch (algorithm) {
		case "nearest-rgb":
			return convertToSpectra6Nearest(
				uri,
				orientation,
				brightness,
				saturation,
			);

		case "floyd-steinberg-rgb":
			return convertToSpectra6FloydSteinberg(
				uri,
				orientation,
				brightness,
				saturation,
			);

		case "floyd-steinberg-oklab-serpentine":
			return convertToSpectra6FloydSteinbergOklabSerpentine(
				uri,
				orientation,
				brightness,
				saturation,
			);

		case "barycentric-blue-noise":
			return convertToSpectra6BarycentricBlueNoise(
				uri,
				orientation,
				brightness,
				saturation,
			);

		case "barycentric-blue-noise-compensated":
			return convertToSpectra6BarycentricBlueNoiseCompensated(
				uri,
				orientation,
				brightness,
				saturation,
			);

		case "good-display-floyd-steinberg":
			return convertToSpectra6GoodDisplayFloydSteinberg(
				uri,
				orientation,
				brightness,
				saturation,
			);
	}
}
