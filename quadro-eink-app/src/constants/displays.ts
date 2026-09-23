import { DisplayOrientation, DisplayType } from "@/types/display";

type DisplayConfig = {
	name: string;
	landscapeWidth: number;
	landscapeHeight: number;
};

export const DISPLAYS: Record<DisplayType, DisplayConfig> = {
	"spectra6-7.3": {
		name: 'Spectra 6 7.3"',
		landscapeWidth: 800,
		landscapeHeight: 480,
	},

	"spectra6-13.3": {
		name: 'Spectra 6 13.3"',
		landscapeWidth: 1600,
		landscapeHeight: 1200,
	},
};

export function getDisplaySize(
	displayType: DisplayType,
	orientation: DisplayOrientation,
) {
	const display = DISPLAYS[displayType];

	if (orientation === "landscape") {
		return {
			width: display.landscapeWidth,
			height: display.landscapeHeight,
		};
	}

	return {
		width: display.landscapeHeight,
		height: display.landscapeWidth,
	};
}
