import { collection, getDocs } from "firebase/firestore";

import { db } from "./config";

export type AuthorizedDevice = {
	id: string;
	name: string;
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

	return snapshot.docs.map((document) => {
		const data = document.data();

		return {
			id: document.id,
			name: data.label ?? document.id,
		};
	});
}
