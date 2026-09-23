import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	updateDoc,
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

export async function getDevice(deviceId: string): Promise<Device | null> {
	const snapshot = await getDoc(doc(db, "devices", deviceId));

	if (!snapshot.exists()) {
		return null;
	}

	return {
		id: snapshot.id,
		...snapshot.data(),
	} as Device;
}

export async function updateDevice(
	deviceId: string,
	data: {
		name: string;
		updateIntervalMinutes: number;
	},
): Promise<void> {
	await updateDoc(doc(db, "devices", deviceId), data);
}

export async function deleteDevice(deviceId: string): Promise<void> {
	await deleteDoc(doc(db, "devices", deviceId));
}
