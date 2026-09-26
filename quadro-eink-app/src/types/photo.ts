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

export type TemporaryPhoto = {
	id: string;

	createdByUid: string;

	previewPath: string;
	epaperFilePath: string;

	width: number;
	height: number;

	expiresAt: Date;
};
