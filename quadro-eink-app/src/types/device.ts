import type { DisplayType } from "@/types/display";

export type Device = {
	id: string;
	name: string;
	displayType: DisplayType;
	updateIntervalMinutes: number;
};
