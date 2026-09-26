import { collection, doc, getDoc, getDocs } from "firebase/firestore";

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
