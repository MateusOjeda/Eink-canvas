import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	onSnapshot,
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

type DisplayHistoryEntry = {
	imageId: string;
	lastDisplayedAt: string;
};

export type DeviceState = {
	lastCollectionId: string | null;
	currentImageId: string | null;
	displayHistory: DisplayHistoryEntry[];
};

export type DevicePriority = {
	collectionId: string;
	imageId: string;
};

export async function getDevicePriority(
	deviceId: string,
): Promise<DevicePriority | null> {
	const snapshot = await getDoc(
		doc(db, "devices", deviceId, "config", "priority"),
	);

	if (!snapshot.exists()) {
		return null;
	}

	const data = snapshot.data();

	if (
		typeof data.collectionId !== "string" ||
		typeof data.imageId !== "string"
	) {
		return null;
	}

	return {
		collectionId: data.collectionId,
		imageId: data.imageId,
	};
}

export async function setDevicePriority(
	deviceId: string,
	collectionId: string | null,
	imageId: string | null,
): Promise<void> {
	await setDoc(doc(db, "devices", deviceId, "config", "priority"), {
		collectionId,
		imageId,
	});
}

export async function getDeviceState(
	deviceId: string,
): Promise<DeviceState | null> {
	const snapshot = await getDoc(
		doc(db, "devices", deviceId, "state", "current"),
	);

	if (!snapshot.exists()) {
		return null;
	}

	const data = snapshot.data();

	if (typeof data.state !== "string") {
		return null;
	}

	try {
		const state = JSON.parse(data.state);

		return {
			lastCollectionId:
				typeof state.lastCollectionId === "string"
					? state.lastCollectionId
					: null,

			currentImageId:
				typeof state.currentImageId === "string"
					? state.currentImageId
					: null,

			displayHistory: Array.isArray(state.displayHistory)
				? state.displayHistory.filter(
						(entry: unknown) =>
							typeof entry === "object" &&
							entry !== null &&
							typeof (entry as DisplayHistoryEntry).imageId ===
								"string" &&
							typeof (entry as DisplayHistoryEntry)
								.lastDisplayedAt === "string",
					)
				: [],
		};
	} catch {
		return null;
	}
}

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
		deviceAuthUid: device.deviceAuthUid,
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

export async function updateDeviceAuthUid(
	deviceId: string,
	deviceAuthUid: string,
): Promise<void> {
	const deviceRef = doc(db, "devices", deviceId);

	await updateDoc(deviceRef, {
		deviceAuthUid,
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

export function subscribeToDeviceProcessingStatus(
	deviceId: string,
	callback: (processing: boolean) => void,
): () => void {
	return onSnapshot(
		doc(db, "devices", deviceId, "state", "current"),
		(snapshot) => {
			if (!snapshot.exists()) {
				console.log("[DeviceProcessing] Documento não existe.");

				callback(false);
				return;
			}

			const data = snapshot.data();

			const status = data.processing?.status;

			const processing = status === "thinking";

			callback(processing);
		},
		(error) => {
			console.error("[DeviceProcessing] Erro no listener:", error);

			callback(false);
		},
	);
}
