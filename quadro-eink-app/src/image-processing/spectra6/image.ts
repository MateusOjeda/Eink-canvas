import {
	AlphaType,
	ColorType,
	ImageFormat,
	Skia,
} from "@shopify/react-native-skia";

import { File, Paths } from "expo-file-system";

import { SPECTRA6_PREVIEW_PALETTE } from "./palette";

import { Spectra6PreviewResult } from "./types";

export async function loadImageRgba(uri: string) {
	const sourceFile = new File(uri);

	const encodedBytes = await sourceFile.bytes();

	const data = Skia.Data.fromBytes(encodedBytes);

	const image = Skia.Image.MakeImageFromEncoded(data);

	if (!image) {
		throw new Error("Não foi possível decodificar a imagem.");
	}

	const width = image.width();

	const height = image.height();

	const pixels = image.readPixels(0, 0, {
		width,
		height,
		colorType: ColorType.RGBA_8888,
		alphaType: AlphaType.Unpremul,
	});

	if (!pixels) {
		throw new Error("Não foi possível ler os pixels.");
	}

	return {
		width,
		height,
		pixels: Uint8Array.from(pixels),
	};
}

export function savePalettePreview(
	paletteIndices: Uint8Array,
	width: number,
	height: number,
	prefix: string,
): Spectra6PreviewResult {
	const rgba = new Uint8Array(width * height * 4);

	for (let pixel = 0; pixel < paletteIndices.length; pixel++) {
		const color = SPECTRA6_PREVIEW_PALETTE[paletteIndices[pixel]];

		const i = pixel * 4;

		rgba[i] = color.r;
		rgba[i + 1] = color.g;
		rgba[i + 2] = color.b;
		rgba[i + 3] = 255;
	}

	const data = Skia.Data.fromBytes(rgba);

	const image = Skia.Image.MakeImage(
		{
			width,
			height,
			colorType: ColorType.RGBA_8888,
			alphaType: AlphaType.Opaque,
		},
		data,
		width * 4,
	);

	if (!image) {
		throw new Error("Não foi possível criar a preview.");
	}

	const pngBytes = image.encodeToBytes(ImageFormat.PNG, 100);

	const outputFile = new File(Paths.cache, `${prefix}-${Date.now()}.png`);

	outputFile.write(pngBytes);

	return {
		uri: outputFile.uri,
		width,
		height,
	};
}
