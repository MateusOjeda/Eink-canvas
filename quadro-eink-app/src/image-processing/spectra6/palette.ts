export const SPECTRA6_PALETTE = [
	{
		name: "black",
		r: 0,
		g: 0,
		b: 0,
		hardwareCode: 0x0,
	},
	{
		name: "white",
		r: 255,
		g: 255,
		b: 255,
		hardwareCode: 0x1,
	},
	{
		name: "yellow",
		r: 255,
		g: 255,
		b: 0,
		hardwareCode: 0x2,
	},
	{
		name: "red",
		r: 255,
		g: 0,
		b: 0,
		hardwareCode: 0x3,
	},
	{
		name: "blue",
		r: 0,
		g: 0,
		b: 255,
		hardwareCode: 0x5,
	},
	{
		name: "green",
		r: 0,
		g: 255,
		b: 0,
		hardwareCode: 0x6,
	},
] as const;

export function findNearestPaletteIndex(r: number, g: number, b: number) {
	let bestIndex = 0;
	let bestDistance = Number.POSITIVE_INFINITY;

	for (let i = 0; i < SPECTRA6_PALETTE.length; i++) {
		const color = SPECTRA6_PALETTE[i];

		const dr = r - color.r;
		const dg = g - color.g;
		const db = b - color.b;

		const distance = dr * dr + dg * dg + db * db;

		if (distance < bestDistance) {
			bestDistance = distance;
			bestIndex = i;
		}
	}

	return bestIndex;
}

export const SPECTRA6_PREVIEW_PALETTE = [
	{ r: 31, g: 34, b: 38 }, // black
	{ r: 185, g: 199, b: 201 }, // white
	{ r: 193, g: 187, b: 30 }, // yellow
	{ r: 98, g: 32, b: 30 }, // red
	{ r: 35, g: 63, b: 142 }, // blue
	{ r: 53, g: 86, b: 58 }, // green
];
