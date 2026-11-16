import {
    collection,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";

import { db } from "./config";

import type { DisplayOrientation, DisplayType } from "../types/display";

export type AuthorizedDevice = {
	id: string;
	name: string;

	displayType: DisplayType;
	orientation: DisplayOrientation;
};

export async function getAuthorizedDevices(
	uid: string,
): Promise<AuthorizedDevice[]> {
	const devicesRef = collection(
		db,
		"temporaryUploadPermissions",
		uid,
		"devices",
	);

	const snapshot = await getDocs(devicesRef);

	const devices = await Promise.all(
		snapshot.docs.map(async (document) => {
			const permissionData = document.data();

			const displaySnapshot = await getDoc(
				doc(db, "devices", document.id, "config", "display"),
			);

			/*
			 * Pode existir uma autorização antiga
			 * apontando para um device já apagado.
			 *
			 * Nesse caso simplesmente ignoramos.
			 */
			if (!displaySnapshot.exists()) {
				console.warn("Autorização órfã ignorada:", document.id);

				return null;
			}

			const displayData = displaySnapshot.data();

			return {
				id: document.id,

				name: permissionData.label ?? document.id,

				displayType: displayData.displayType as DisplayType,

				orientation: displayData.orientation as DisplayOrientation,
			};
		}),
	);

	return devices.filter(
		(device): device is AuthorizedDevice => device !== null,
	);
}

export type PublicDevice = {
    id: string;
    name: string;
    ownerUid: string;
    displayType: DisplayType;
    orientation: DisplayOrientation;
};

export async function getPublicDevices(): Promise<PublicDevice[]> {
    const snapshot = await getDocs(collection(db, "publicDevices"));
    return snapshot.docs.map((item) => {
        const data = item.data();
        return {
            id: item.id,
            name: data.name as string,
            ownerUid: data.ownerUid as string,
            displayType: data.displayType as DisplayType,
            orientation: data.orientation as DisplayOrientation,
        };
    });
}

export async function getPendingRequestIds(
    uid: string,
    publicDevices: PublicDevice[],
): Promise<string[]> {
    const results = await Promise.all(publicDevices.map(async (device) => {
        const request = await getDoc(
            doc(db, "devices", device.id, "uploadAccessRequests", uid),
        );
        return request.exists() ? device.id : null;
    }));
    return results.filter((id): id is string => id !== null);
}

export async function requestUploadAccess(
    user: User,
    deviceId: string,
): Promise<void> {
    if (!user.email) {
        throw new Error("Sua conta Google não possui um e-mail.");
    }

    await setDoc(
        doc(db, "devices", deviceId, "uploadAccessRequests", user.uid),
        { email: user.email, requestedAt: serverTimestamp() },
    );
}
