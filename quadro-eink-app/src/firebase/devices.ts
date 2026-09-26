import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	query,
	setDoc,
	updateDoc,
	where,
} from "firebase/firestore";

import { auth, db } from "./config";

import type { Device } from "@/types/device";

import type { DisplayOrientation, DisplayType } from "@/types/display";

type DeviceDisplayConfig = {
	displayType: DisplayType;
	orientation: DisplayOrientation;
};

async function getDeviceDisplayConfig(
	deviceId: string,
): Promise<DeviceDisplayConfig> {
	const snapshot = await getDoc(
		doc(db, "devices", deviceId, "config", "display"),
	);

	if (!snapshot.exists()) {
		throw new Error(
			"Configuração de display do dispositivo não encontrada.",
		);
	}

	const data = snapshot.data();

	return {
		displayType: data.displayType,
		orientation: data.orientation,
	};
}

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

	return Promise.all(
		snapshot.docs.map(async (document) => {
			const data = document.data();

			const displayConfig = await getDeviceDisplayConfig(document.id);

			return {
				id: document.id,

				name: data.name,

				displayType: displayConfig.displayType,

				orientation: displayConfig.orientation,

				updateIntervalMinutes: data.updateIntervalMinutes,

				ownerUid: data.ownerUid,
			} as Device;
		}),
	);
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

	const displayConfig = await getDeviceDisplayConfig(deviceId);

	return {
		id: snapshot.id,

		name: data.name,

		displayType: displayConfig.displayType,

		orientation: displayConfig.orientation,

		updateIntervalMinutes: data.updateIntervalMinutes,

		ownerUid: data.ownerUid,
	} as Device;
}

export async function createDevice(
	device: Omit<Device, "ownerUid">,
): Promise<void> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error("Usuário não autenticado.");
	}

	const deviceRef = doc(db, "devices", device.id);

	/*
	 * Primeiro criamos o Device.
	 *
	 * displayType e orientation NÃO ficam mais
	 * neste documento.
	 */
	await setDoc(deviceRef, {
		name: device.name,

		updateIntervalMinutes: device.updateIntervalMinutes,

		ownerUid: user.uid,
	});

	/*
	 * Esta passa a ser a fonte oficial
	 * da configuração física do display.
	 */
	await setDoc(doc(db, "devices", device.id, "config", "display"), {
		displayType: device.displayType,
		orientation: device.orientation,
	});
}

export async function updateDevice(
	deviceId: string,
	data: {
		name: string;
		orientation: DisplayOrientation;
		updateIntervalMinutes: number;

		displayType?: DisplayType;
	},
): Promise<void> {
	await updateDoc(doc(db, "devices", deviceId), {
		name: data.name,

		updateIntervalMinutes: data.updateIntervalMinutes,
	});

	const displayData: {
		orientation: DisplayOrientation;
		displayType?: DisplayType;
	} = {
		orientation: data.orientation,
	};

	if (data.displayType) {
		displayData.displayType = data.displayType;
	}

	await updateDoc(
		doc(db, "devices", deviceId, "config", "display"),
		displayData,
	);
}

export async function deleteDevice(deviceId: string): Promise<void> {
	/*
	 * Firestore não apaga subcollections
	 * automaticamente quando o documento pai
	 * é removido.
	 *
	 * Então removemos config/display primeiro.
	 */
	await deleteDoc(doc(db, "devices", deviceId, "config", "display"));

	await deleteDoc(doc(db, "devices", deviceId));
}
