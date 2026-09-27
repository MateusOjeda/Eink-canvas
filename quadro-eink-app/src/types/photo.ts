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

export type YearlyDate = {
	month: number;
	day: number;
};

type TemporaryPhotoBase = {
	id: string;

	createdByUid: string;

	previewPath: string;
	epaperFilePath: string;

	width: number;
	height: number;
};

export type TemporaryPhoto =
	| (TemporaryPhotoBase & {
			recurrence: "once";
			durationMinutes: number;
	  })
	| (TemporaryPhotoBase & {
			recurrence: "yearly";
			yearlyDate: YearlyDate;
	  });
