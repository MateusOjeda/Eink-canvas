import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	setDoc,
	updateDoc,
} from "firebase/firestore";

import { db } from "./config";

import type { Device } from "@/types/device";
import type { DisplayOrientation } from "@/types/display";

export async function getDevices(): Promise<Device[]> {
	const snapshot = await getDocs(collection(db, "devices"));

	return snapshot.docs.map((document) => {
		const data = document.data();

		return {
			id: document.id,
			name: data.name,
			displayType: data.displayType,
			orientation: data.orientation ?? "portrait",
			updateIntervalMinutes: data.updateIntervalMinutes,
		} as Device;
	});
}

export async function getDevice(deviceId: string): Promise<Device | null> {
	const snapshot = await getDoc(doc(db, "devices", deviceId));

	if (!snapshot.exists()) {
		return null;
	}

	const data = snapshot.data();

	return {
		id: snapshot.id,
		name: data.name,
		displayType: data.displayType,
		orientation: data.orientation ?? "portrait",
		updateIntervalMinutes: data.updateIntervalMinutes,
	} as Device;
}

export async function createDevice(device: Device): Promise<void> {
	const deviceRef = doc(db, "devices", device.id);

	const existingDevice = await getDoc(deviceRef);

	if (existingDevice.exists()) {
		throw new Error("Já existe um dispositivo com esse ID.");
	}

	await setDoc(deviceRef, {
		name: device.name,
		displayType: device.displayType,
		orientation: device.orientation,
		updateIntervalMinutes: device.updateIntervalMinutes,
	});
}

export async function updateDevice(
	deviceId: string,
	data: {
		name: string;
		orientation: DisplayOrientation;
		updateIntervalMinutes: number;
	},
): Promise<void> {
	await updateDoc(doc(db, "devices", deviceId), data);
}

export async function deleteDevice(deviceId: string): Promise<void> {
	await deleteDoc(doc(db, "devices", deviceId));
}
