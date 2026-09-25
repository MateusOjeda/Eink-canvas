import { loadImageRgba, savePalettePreview } from "../image";

import { saveSpectra6Binary } from "../binary";

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

	/*
	 * Índice lógico usado internamente
	 * pelo nosso projeto.
	 *
	 * 0 = black
	 * 1 = white
	 * 2 = yellow
	 * 3 = red
	 * 4 = blue
	 * 5 = green
	 */
	index: number;

	lab?: Lab;
};

/*
 * Paleta usada pelo usb2epd.html
 * para realizar a quantização.
 *
 * Esses RGBs são da ferramenta da
 * Good Display, não do nosso preview.
 */
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

/*
 * Valores padrão da ferramenta oficial.  TODO: TESTAR outros valores
 */
const CONTRAST = 1.2;

const DITHER_STRENGTH = 1.0;

/*
 * Conversão RGB -> CIELAB copiada da
 * lógica do usb2epd.html.
 */
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

/*
 * Distância utilizada pela Good Display.
 *
 * Luminosidade recebe peso 0.2.
 * Componentes cromáticos recebem peso 3.
 */
function labDistance(lab1: Lab, lab2: Lab) {
	const dl = lab1.l - lab2.l;

	const da = lab1.a - lab2.a;

	const db = lab1.b - lab2.b;

	return Math.sqrt(0.2 * dl * dl + 3 * da * da + 3 * db * db);
}

/*
 * Calculamos o Lab das cores da paleta
 * apenas uma vez.
 *
 * A ferramenta original recalcula,
 * mas o resultado matemático é o mesmo.
 */
for (const color of GOOD_DISPLAY_PALETTE) {
	color.lab = rgbToLab(color.r, color.g, color.b);
}

const BLUE = GOOD_DISPLAY_PALETTE.find((color) => color.name === "blue")!;

/*
 * Escolha da cor mais próxima.
 *
 * Inclui o caso especial de azul
 * presente no código da Good Display.
 */
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

/*
 * Ajuste de contraste usado pela
 * ferramenta oficial.
 *
 * (value - 128) * 1.2 + 128
 *
 * Uint8ClampedArray reproduz o comportamento
 * do ImageData do navegador.
 */
function applyContrast(pixels: Uint8ClampedArray) {
	for (let i = 0; i < pixels.length; i += 4) {
		pixels[i] = (pixels[i] - 128) * CONTRAST + 128;

		pixels[i + 1] = (pixels[i + 1] - 128) * CONTRAST + 128;

		pixels[i + 2] = (pixels[i + 2] - 128) * CONTRAST + 128;
	}
}

/*
 * Floyd-Steinberg da ferramenta Good Display.
 *
 * É importante:
 *
 * - não é serpentine;
 * - percorre sempre esquerda -> direita;
 * - usa Uint8ClampedArray durante a difusão;
 * - quantiza novamente em uma segunda passagem.
 */
function quantizeGoodDisplayFloydSteinberg(
	inputPixels: Uint8Array,
	width: number,
	height: number,
): Uint8Array {
	/*
	 * Primeiro fazemos uma cópia clamped,
	 * como o ImageData do navegador.
	 */
	const contrastedPixels = new Uint8ClampedArray(inputPixels);

	applyContrast(contrastedPixels);

	/*
	 * O Floyd original cria outra cópia
	 * dos dados antes de espalhar o erro.
	 */
	const tempData = new Uint8ClampedArray(contrastedPixels);

	/*
	 * PRIMEIRA PASSAGEM:
	 * difusão do erro.
	 */
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

			/*
			 * Direita
			 *
			 * 7 / 16
			 */
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
				/*
				 * Baixo-esquerda
				 *
				 * 3 / 16
				 */
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

				/*
				 * Baixo
				 *
				 * 5 / 16
				 */
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

				/*
				 * Baixo-direita
				 *
				 * 1 / 16
				 */
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

	/*
	 * SEGUNDA PASSAGEM:
	 *
	 * A implementação original não simplesmente
	 * guarda "closest" durante o Floyd.
	 *
	 * Ela termina a difusão e só depois
	 * quantiza novamente cada pixel.
	 */
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

/*
 * Interface pública do algoritmo.
 *
 * Mantém exatamente o mesmo contrato
 * dos outros algoritmos do projeto:
 *
 * URI
 * ↓
 * pixels RGBA
 * ↓
 * quantização
 * ↓
 * preview PNG
 * ↓
 * .bin 4 bpp
 */
export async function convertToSpectra6GoodDisplayFloydSteinberg(uri: string) {
	const totalStart = Date.now();

	const { width, height, pixels } = await loadImageRgba(uri);

	const quantizeStart = Date.now();

	const paletteIndices = quantizeGoodDisplayFloydSteinberg(
		pixels,
		width,
		height,
	);

	const quantizeMs = Date.now() - quantizeStart;

	const prefix = `good-display-${Date.now()}`;

	const preview = savePalettePreview(paletteIndices, width, height, prefix);

	const binUri = saveSpectra6Binary(paletteIndices, width, height, prefix);

	const totalMs = Date.now() - totalStart;

	console.log("[Good Display Floyd-Steinberg]", {
		width,
		height,
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
