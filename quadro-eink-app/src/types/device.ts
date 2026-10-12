import type { DisplayType, DisplayOrientation } from "@/types/display";

export type Device = {
	id: string;
	name: string;
	displayType: DisplayType;
	orientation: DisplayOrientation;
	updateTimes: string[];
	ownerUid: string;
	deviceAuthUid: string;
};
