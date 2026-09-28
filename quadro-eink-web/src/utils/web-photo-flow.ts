import type { AuthorizedDevice } from "../firebase/permissions";

export type SelectedImage = {
	uri: string;
	width: number;
	height: number;
};

export type ProcessedTemporaryPhoto = {
	previewBlob: Blob;
	binBytes: Uint8Array;
	width: number;
	height: number;
};

export const DURATION_OPTIONS = [
	{ label: "30 min", minutes: 30 },
	{ label: "1 hora", minutes: 60 },
	{ label: "2 horas", minutes: 120 },
	{ label: "3 horas", minutes: 180 },
] as const;

export const MOVE_STEP = 15;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.1;

export function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function getDisplayName(device: AuthorizedDevice): string {
	if (device.displayType === "spectra6-7.3") {
		return 'Spectra 6 — 7,3"';
	}

	if (device.displayType === "spectra6-13.3") {
		return 'Spectra 6 — 13,3"';
	}

	return device.displayType;
}

export function getOrientationName(device: AuthorizedDevice): string {
	return device.orientation === "portrait" ? "Retrato" : "Paisagem";
}

export function getCropFrameSize(
	targetWidth: number,
	targetHeight: number,
) {
	const maxWidth = 320;
	const maxHeight = 420;

	const ratio = targetWidth / targetHeight;

	let width = maxWidth;
	let height = width / ratio;

	if (height > maxHeight) {
		height = maxHeight;
		width = height * ratio;
	}

	return {
		width,
		height,
	};
}

export function getDisplayedImageSize(
	imageWidth: number,
	imageHeight: number,
	frameWidth: number,
	frameHeight: number,
	zoom: number,
) {
	const imageRatio = imageWidth / imageHeight;
	const frameRatio = frameWidth / frameHeight;

	let baseWidth = 0;
	let baseHeight = 0;

	if (imageRatio > frameRatio) {
		baseHeight = frameHeight;
		baseWidth = baseHeight * imageRatio;
	} else {
		baseWidth = frameWidth;
		baseHeight = baseWidth / imageRatio;
	}

	return {
		width: baseWidth * zoom,
		height: baseHeight * zoom,
	};
}

export function clampCropOffsets({
	offsetX,
	offsetY,
	displayedWidth,
	displayedHeight,
	frameWidth,
	frameHeight,
}: {
	offsetX: number;
	offsetY: number;
	displayedWidth: number;
	displayedHeight: number;
	frameWidth: number;
	frameHeight: number;
}) {
	const maxOffsetX = Math.max(
		0,
		(displayedWidth - frameWidth) / 2,
	);
	const maxOffsetY = Math.max(
		0,
		(displayedHeight - frameHeight) / 2,
	);

	return {
		offsetX: clamp(
			offsetX,
			-maxOffsetX,
			maxOffsetX,
		),
		offsetY: clamp(
			offsetY,
			-maxOffsetY,
			maxOffsetY,
		),
	};
}

export function buildCropRect({
	sourceWidth,
	sourceHeight,
	frameWidth,
	frameHeight,
	displayedWidth,
	displayedHeight,
	offsetX,
	offsetY,
}: {
	sourceWidth: number;
	sourceHeight: number;
	frameWidth: number;
	frameHeight: number;
	displayedWidth: number;
	displayedHeight: number;
	offsetX: number;
	offsetY: number;
}) {
	const left =
		(frameWidth - displayedWidth) / 2 +
		offsetX;
	const top =
		(frameHeight - displayedHeight) / 2 +
		offsetY;

	const cropWidth =
		(frameWidth / displayedWidth) *
		sourceWidth;

	const cropHeight =
		(frameHeight / displayedHeight) *
		sourceHeight;

	let x =
		(-left / displayedWidth) * sourceWidth;
	let y =
		(-top / displayedHeight) * sourceHeight;

	x = clamp(x, 0, sourceWidth - cropWidth);
	y = clamp(y, 0, sourceHeight - cropHeight);

	return {
		x: Math.round(x),
		y: Math.round(y),
		width: Math.round(cropWidth),
		height: Math.round(cropHeight),
	};
}
