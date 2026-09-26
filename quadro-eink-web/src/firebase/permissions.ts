import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import { db } from "./config";

import type { DisplayOrientation, DisplayType } from "@/types/display";

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

	return Promise.all(
		snapshot.docs.map(async (document) => {
			const permissionData = document.data();

			const displaySnapshot = await getDoc(
				doc(db, "devices", document.id, "config", "display"),
			);

			if (!displaySnapshot.exists()) {
				throw new Error(
					`Configuração de display não encontrada para ${document.id}.`,
				);
			}

			const displayData = displaySnapshot.data();

			return {
				id: document.id,

				name: permissionData.label ?? document.id,

				displayType: displayData.displayType,

				orientation: displayData.orientation,
			} as AuthorizedDevice;
		}),
	);
}
