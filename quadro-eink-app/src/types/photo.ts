export type Photo = {
	id: string;

	active: boolean;

	previewPath: string;
	thumbnailPath: string;
	epaperFilePath: string;

	width: number;
	height: number;

	createdAt?: unknown;
};
