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

function getUpdateTimes(value: unknown): string[] {
	if (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every(
			(time): time is string =>
				typeof time === "string" &&
				/^([01]\d|2[0-3]):[0-5]\d$/.test(time),
		)
	) {
		return [...new Set(value)].sort();
	}

	return [];
}

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
				updateTimes: getUpdateTimes(data.updateTimes),
				ownerUid: data.ownerUid,
				deviceAuthUid: data.deviceAuthUid,
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
		updateTimes: getUpdateTimes(data.updateTimes),
		ownerUid: data.ownerUid,
		deviceAuthUid: data.deviceAuthUid,
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

	await setDoc(deviceRef, {
		name: device.name,
		updateTimes: getUpdateTimes(device.updateTimes),
		ownerUid: user.uid,
		deviceAuthUid: device.deviceAuthUid,
	});

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
		updateTimes: string[];
		displayType?: DisplayType;
	},
): Promise<void> {
	const updateTimes = getUpdateTimes(data.updateTimes);

	if (updateTimes.length !== data.updateTimes.length) {
		throw new Error("A lista de horários de atualização é inválida.");
	}

	await updateDoc(doc(db, "devices", deviceId), {
		name: data.name,
		updateTimes,
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
	await deleteDoc(doc(db, "devices", deviceId, "config", "display"));

	await deleteDoc(doc(db, "devices", deviceId));
}

export function subscribeToDeviceProcessingStatus(
	deviceId: string,
	callback: (processing: boolean) => void,
): () => void {
	let timeout: ReturnType<typeof setTimeout> | undefined;

	const unsubscribe = onSnapshot(
		doc(db, "devices", deviceId, "state", "current"),
		(snapshot) => {
			if (timeout) {
				clearTimeout(timeout);
				timeout = undefined;
			}

			if (!snapshot.exists()) {
				console.log("[DeviceProcessing] Documento não existe.");
				callback(false);
				return;
			}

			const data = snapshot.data();
			const status = data.processing?.status;
			const updatedAt = data.processing?.updatedAt;

			if (status !== "thinking" || !updatedAt) {
				callback(false);
				return;
			}

			const elapsed = Date.now() - updatedAt.toMillis();
			const remaining = 2 * 60 * 1000 - elapsed;

			if (remaining <= 0) {
				callback(false);
				return;
			}

			callback(true);

			timeout = setTimeout(() => {
				callback(false);
				timeout = undefined;
			}, remaining);
		},
		(error) => {
			console.error("[DeviceProcessing] Erro no listener:", error);
			callback(false);
		},
	);

	return () => {
		unsubscribe();

		if (timeout) {
			clearTimeout(timeout);
		}
	};
}
