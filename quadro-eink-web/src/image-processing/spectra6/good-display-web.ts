type Lab = {
	l: number;
	a: number;
	b: number;
};

type GoodDisplayColor = {
	name: "yellow" | "green" | "blue" | "red" | "black" | "white";
	r: number;
	g: number;
	b: number;
	index: number;
	lab?: Lab;
};

type CropRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type WebSpectra6Result = {
	previewBlob: Blob;
	binBytes: Uint8Array;
	width: number;
	height: number;
};

const PREVIEW_PALETTE = [
	{ r: 0, g: 0, b: 0 }, // black
	{ r: 255, g: 255, b: 255 }, // white
	{ r: 255, g: 255, b: 0 }, // yellow
	{ r: 255, g: 0, b: 0 }, // red
	{ r: 0, g: 0, b: 255 }, // blue
	{ r: 41, g: 204, b: 20 }, // green
] as const;

/*
 * Índice lógico:
 *
 * 0 = black
 * 1 = white
 * 2 = yellow
 * 3 = red
 * 4 = blue
 * 5 = green
 *
 * Código Spectra 6:
 *
 * black  = 0x0
 * white  = 0x1
 * yellow = 0x2
 * red    = 0x3
 * blue   = 0x5
 * green  = 0x6
 */
const HARDWARE_CODES = [0x0, 0x1, 0x2, 0x3, 0x5, 0x6] as const;

const GOOD_DISPLAY_PALETTE: GoodDisplayColor[] = [
	{
		name: "yellow",
		r: 255,
		g: 255,
		b: 0,
		index: 2,
	},
	{
		name: "green",
		r: 41,
		g: 204,
		b: 20,
		index: 5,
	},
	{
		name: "blue",
		r: 0,
		g: 0,
		b: 255,
		index: 4,
	},
	{
		name: "red",
		r: 255,
		g: 0,
		b: 0,
		index: 3,
	},
	{
		name: "black",
		r: 0,
		g: 0,
		b: 0,
		index: 0,
	},
	{
		name: "white",
		r: 255,
		g: 255,
		b: 255,
		index: 1,
	},
];

const CONTRAST = 1.2;
const DITHER_STRENGTH = 1.0;

function rgbToLab(r: number, g: number, b: number): Lab {
	let red = r / 255;
	let green = g / 255;
	let blue = b / 255;

	red = red > 0.04045 ? Math.pow((red + 0.055) / 1.055, 2.4) : red / 12.92;

	green =
		green > 0.04045
			? Math.pow((green + 0.055) / 1.055, 2.4)
			: green / 12.92;

	blue =
		blue > 0.04045 ? Math.pow((blue + 0.055) / 1.055, 2.4) : blue / 12.92;

	red *= 100;
	green *= 100;
	blue *= 100;

	let x = red * 0.4124 + green * 0.3576 + blue * 0.1805;
	let y = red * 0.2126 + green * 0.7152 + blue * 0.0722;
	let z = red * 0.0193 + green * 0.1192 + blue * 0.9505;

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
	y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
	z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

	return {
		l: 116 * y - 16,
		a: 500 * (x - y),
		b: 200 * (y - z),
	};
}

function labDistance(lab1: Lab, lab2: Lab) {
	const dl = lab1.l - lab2.l;
	const da = lab1.a - lab2.a;
	const db = lab1.b - lab2.b;

	return Math.sqrt(0.2 * dl * dl + 3 * da * da + 3 * db * db);
}

for (const color of GOOD_DISPLAY_PALETTE) {
	color.lab = rgbToLab(color.r, color.g, color.b);
}

const BLUE = GOOD_DISPLAY_PALETTE.find((color) => color.name === "blue")!;

function findClosestColor(r: number, g: number, b: number): GoodDisplayColor {
	if (r < 50 && g < 150 && b > 100) {
		return BLUE;
	}

	const inputLab = rgbToLab(r, g, b);

	let minDistance = Infinity;
	let closestColor = GOOD_DISPLAY_PALETTE[0];

	for (const color of GOOD_DISPLAY_PALETTE) {
		const distance = labDistance(inputLab, color.lab!);

		if (distance < minDistance) {
			minDistance = distance;
			closestColor = color;
		}
	}

	return closestColor;
}

function applyContrast(pixels: Uint8ClampedArray) {
	for (let i = 0; i < pixels.length; i += 4) {
		pixels[i] = (pixels[i] - 128) * CONTRAST + 128;
		pixels[i + 1] = (pixels[i + 1] - 128) * CONTRAST + 128;
		pixels[i + 2] = (pixels[i + 2] - 128) * CONTRAST + 128;
	}
}

function quantizeGoodDisplayFloydSteinberg(
	inputPixels: Uint8ClampedArray,
	width: number,
	height: number,
): Uint8Array {
	const contrastedPixels = new Uint8ClampedArray(inputPixels);

	applyContrast(contrastedPixels);

	const tempData = new Uint8ClampedArray(contrastedPixels);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = (y * width + x) * 4;

			const r = tempData[idx];
			const g = tempData[idx + 1];
			const b = tempData[idx + 2];

			const closest = findClosestColor(r, g, b);

			const errR = (r - closest.r) * DITHER_STRENGTH;
			const errG = (g - closest.g) * DITHER_STRENGTH;
			const errB = (b - closest.b) * DITHER_STRENGTH;

			if (x + 1 < width) {
				const target = idx + 4;

				tempData[target] = Math.min(
					255,
					Math.max(0, tempData[target] + (errR * 7) / 16),
				);

				tempData[target + 1] = Math.min(
					255,
					Math.max(0, tempData[target + 1] + (errG * 7) / 16),
				);

				tempData[target + 2] = Math.min(
					255,
					Math.max(0, tempData[target + 2] + (errB * 7) / 16),
				);
			}

			if (y + 1 < height) {
				if (x > 0) {
					const target = idx + width * 4 - 4;

					tempData[target] = Math.min(
						255,
						Math.max(0, tempData[target] + (errR * 3) / 16),
					);

					tempData[target + 1] = Math.min(
						255,
						Math.max(0, tempData[target + 1] + (errG * 3) / 16),
					);

					tempData[target + 2] = Math.min(
						255,
						Math.max(0, tempData[target + 2] + (errB * 3) / 16),
					);
				}

				{
					const target = idx + width * 4;

					tempData[target] = Math.min(
						255,
						Math.max(0, tempData[target] + (errR * 5) / 16),
					);

					tempData[target + 1] = Math.min(
						255,
						Math.max(0, tempData[target + 1] + (errG * 5) / 16),
					);

					tempData[target + 2] = Math.min(
						255,
						Math.max(0, tempData[target + 2] + (errB * 5) / 16),
					);
				}

				if (x + 1 < width) {
					const target = idx + width * 4 + 4;

					tempData[target] = Math.min(
						255,
						Math.max(0, tempData[target] + errR / 16),
					);

					tempData[target + 1] = Math.min(
						255,
						Math.max(0, tempData[target + 1] + errG / 16),
					);

					tempData[target + 2] = Math.min(
						255,
						Math.max(0, tempData[target + 2] + errB / 16),
					);
				}
			}
		}
	}

	const paletteIndices = new Uint8Array(width * height);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const rgbaIndex = (y * width + x) * 4;
			const pixelIndex = y * width + x;

			const closest = findClosestColor(
				tempData[rgbaIndex],
				tempData[rgbaIndex + 1],
				tempData[rgbaIndex + 2],
			);

			paletteIndices[pixelIndex] = closest.index;
		}
	}

	return paletteIndices;
}

function createSpectra6Binary(
	paletteIndices: Uint8Array,
	width: number,
	height: number,
): Uint8Array {
	const expectedPixels = width * height;

	if (paletteIndices.length !== expectedPixels) {
		throw new Error(
			`Quantidade inválida de pixels: ${paletteIndices.length}, esperado ${expectedPixels}`,
		);
	}

	const output = new Uint8Array(Math.ceil(expectedPixels / 2));

	for (let pixel = 0; pixel < expectedPixels; pixel += 2) {
		const firstIndex = paletteIndices[pixel];

		const secondIndex =
			pixel + 1 < expectedPixels ? paletteIndices[pixel + 1] : 1;

		const firstCode = HARDWARE_CODES[firstIndex];
		const secondCode = HARDWARE_CODES[secondIndex];

		if (firstCode === undefined || secondCode === undefined) {
			throw new Error("Índice de cor Spectra 6 inválido.");
		}

		output[pixel >> 1] = (firstCode << 4) | secondCode;
	}

	return output;
}

async function loadImageElement(uri: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new window.Image();

		image.onload = () => resolve(image);
		image.onerror = () =>
			reject(new Error("Não foi possível carregar a imagem."));
		image.src = uri;
	});
}

async function createPreviewBlob(
	paletteIndices: Uint8Array,
	width: number,
	height: number,
): Promise<Blob> {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;

	const ctx = canvas.getContext("2d");

	if (!ctx) {
		throw new Error("Não foi possível criar o contexto do canvas.");
	}

	const imageData = ctx.createImageData(width, height);

	for (let pixel = 0; pixel < paletteIndices.length; pixel++) {
		const color = PREVIEW_PALETTE[paletteIndices[pixel]];
		const i = pixel * 4;

		imageData.data[i] = color.r;
		imageData.data[i + 1] = color.g;
		imageData.data[i + 2] = color.b;
		imageData.data[i + 3] = 255;
	}

	ctx.putImageData(imageData, 0, 0);

	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error("Não foi possível gerar o preview PNG."));
				return;
			}

			resolve(blob);
		}, "image/png");
	});
}

export async function convertToSpectra6GoodDisplayWeb({
	uri,
	crop,
	outputWidth,
	outputHeight,
}: {
	uri: string;
	crop: CropRect;
	outputWidth: number;
	outputHeight: number;
}): Promise<WebSpectra6Result> {
	const image = await loadImageElement(uri);

	const canvas = document.createElement("canvas");
	canvas.width = outputWidth;
	canvas.height = outputHeight;

	const ctx = canvas.getContext("2d");

	if (!ctx) {
		throw new Error("Não foi possível criar o contexto do canvas.");
	}

	ctx.drawImage(
		image,
		crop.x,
		crop.y,
		crop.width,
		crop.height,
		0,
		0,
		outputWidth,
		outputHeight,
	);

	const imageData = ctx.getImageData(0, 0, outputWidth, outputHeight);

	const paletteIndices = quantizeGoodDisplayFloydSteinberg(
		imageData.data,
		outputWidth,
		outputHeight,
	);

	const previewBlob = await createPreviewBlob(
		paletteIndices,
		outputWidth,
		outputHeight,
	);

	const binBytes = createSpectra6Binary(
		paletteIndices,
		outputWidth,
		outputHeight,
	);

	return {
		previewBlob,
		binBytes,
		width: outputWidth,
		height: outputHeight,
	};
}
