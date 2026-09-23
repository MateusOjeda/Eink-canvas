import {
	collection,
	doc,
	getDoc,
	getDocs,
	setDoc,
	deleteDoc,
} from "firebase/firestore";

import { db } from "./config";

import type { Device } from "@/types/device";

export async function getDevices(): Promise<Device[]> {
	const snapshot = await getDocs(collection(db, "devices"));

	return snapshot.docs.map((document) => ({
		id: document.id,
		...document.data(),
	})) as Device[];
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
		updateIntervalMinutes: device.updateIntervalMinutes,
	});
}

export async function deleteDevice(deviceId: string): Promise<void> {
	await deleteDoc(doc(db, "devices", deviceId));
}
