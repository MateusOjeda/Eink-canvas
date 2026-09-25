import type { DisplayType, DisplayOrientation } from "@/types/display";

export type Device = {
	id: string;
	name: string;
	displayType: DisplayType;
	orientation: DisplayOrientation;
	updateIntervalMinutes: number;
	ownerUid: string;
};
