import type { DisplayType } from "@/types/display";

export type Device = {
	id: string;
	name: string;
	displayType: DisplayType;
	updateInterval: number;
};

export const mockDevices: Device[] = [
	// Teste com zero:
	// nenhum item
	// Teste com um:
	{
		id: "d73584a9e12b4e5c91f0a762d7501d66",
		name: "Quadro da sala",
		displayType: "spectra6-13.3",
		updateInterval: 2,
	},
	// Teste com vários:
	// {
	// 	id: "d73584a9e12b4e5c91f0a762d7501d66",
	// 	name: "Quadro da sala",
	// 	displayType: "spectra6-13.3",
	// 	updateInterval: 2,
	// },
	// {
	// 	id: "a2c9710f64e9472c81e5fc93d712a961",
	// 	name: "Quadro do quarto",
	// 	displayType: "spectra6-7.3",
	// 	updateInterval: 4,
	// },
];
