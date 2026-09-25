import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	setDoc,
	updateDoc,
	where,
	query,
} from "firebase/firestore";

import { auth, db } from "./config";

import type { Device } from "@/types/device";
import type { DisplayOrientation } from "@/types/display";

export async function getDevices(): Promise<Device[]> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error("Usuário não autenticado.");
	}

	const devicesQuery = query(
		collection(db, "devices"),
		where("ownerUid", "==", user.uid),
	);

	const snapshot = await getDocs(devicesQuery);

	return snapshot.docs.map((document) => {
		const data = document.data();

		return {
			id: document.id,
			name: data.name,
			displayType: data.displayType,
			orientation: data.orientation ?? "portrait",
			updateIntervalMinutes: data.updateIntervalMinutes,
			ownerUid: data.ownerUid,
		} as Device;
	});
}

export async function getDevice(deviceId: string): Promise<Device | null> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error("Usuário não autenticado.");
	}

	const snapshot = await getDoc(doc(db, "devices", deviceId));

	if (!snapshot.exists()) {
		return null;
	}

	const data = snapshot.data();

	if (data.ownerUid !== user.uid) {
		return null;
	}

	return {
		id: snapshot.id,
		name: data.name,
		displayType: data.displayType,
		orientation: data.orientation ?? "portrait",
		updateIntervalMinutes: data.updateIntervalMinutes,
		ownerUid: data.ownerUid,
	} as Device;
}

export async function createDevice(device: Device): Promise<void> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error("Usuário não autenticado.");
	}

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
		ownerUid: user.uid,
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
