export const MAX_PHOTO_DESCRIPTION_LENGTH = 300;

export type Photo = {
	id: string;

	active: boolean;

	previewPath: string;
	thumbnailPath: string;
	epaperFilePath: string;

	width: number;
	height: number;

	createdAt?: unknown;

	description?: string;
};
