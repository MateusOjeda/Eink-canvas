export type Spectra6PreviewResult = {
	uri: string;
	width: number;
	height: number;
};

export type Spectra6Result = {
	uri: string;
	binUri: string;
	width: number;
	height: number;
};

export type Spectra6Quantizer = (
	rgba: Uint8Array,
	width: number,
	height: number,
) => Uint8Array;

export type Spectra6Algorithm =
	| "nearest-rgb"
	| "floyd-steinberg-rgb"
	| "floyd-steinberg-oklab-serpentine"
	| "barycentric-blue-noise"
	| "barycentric-blue-noise-compensated"
	| "good-display-floyd-steinberg";
