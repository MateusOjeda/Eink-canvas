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

export function adjustImageRgba(
	pixels: Uint8Array,
	brightness: number,
	saturation: number,
): Uint8Array {
	if (brightness === 0 && saturation === 100) {
		return pixels;
	}

	const adjusted = Uint8Array.from(pixels);
	const brightnessOffset = brightness * 2.55;
	const saturationFactor = saturation / 100;

	for (let i = 0; i < adjusted.length; i += 4) {
		const r = adjusted[i];
		const g = adjusted[i + 1];
		const b = adjusted[i + 2];

		// Brilho
		const brightR = Math.max(0, Math.min(255, r + brightnessOffset));
		const brightG = Math.max(0, Math.min(255, g + brightnessOffset));
		const brightB = Math.max(0, Math.min(255, b + brightnessOffset));

		// Saturação baseada na luminância percebida
		const luminance =
			0.2126 * brightR + 0.7152 * brightG + 0.0722 * brightB;

		adjusted[i] = Math.max(
			0,
			Math.min(255, luminance + (brightR - luminance) * saturationFactor),
		);

		adjusted[i + 1] = Math.max(
			0,
			Math.min(255, luminance + (brightG - luminance) * saturationFactor),
		);

		adjusted[i + 2] = Math.max(
			0,
			Math.min(255, luminance + (brightB - luminance) * saturationFactor),
		);
	}

	return adjusted;
}

export async function createAdjustedPreview(
	pixels: Uint8Array,
	width: number,
	height: number,
	brightness: number,
	saturation: number,
): Promise<Uint8Array> {
	const adjustedPixels = adjustImageRgba(pixels, brightness, saturation);

	const image = Skia.Image.MakeImage(
		{
			width,
			height,
			colorType: ColorType.RGBA_8888,
			alphaType: AlphaType.Unpremul,
		},
		Skia.Data.fromBytes(adjustedPixels),
		width * 4,
	);

	if (!image) {
		throw new Error("Não foi possível criar a imagem da prévia.");
	}

	return image.encodeToBytes(ImageFormat.JPEG, 85);
}

export async function saveAdjustedImage(
	uri: string,
	brightness: number,
	saturation: number,
): Promise<string> {
	const { pixels, width, height } = await loadImageRgba(uri);

	const jpegBytes = await createAdjustedPreview(
		pixels,
		width,
		height,
		brightness,
		saturation,
	);

	const file = new File(
		Paths.cache,
		`adjusted-thumbnail-source-${Date.now()}.jpg`,
	);

	await file.write(jpegBytes);

	return file.uri;
}
