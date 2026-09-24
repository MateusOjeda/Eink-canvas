import { collection, getDocs, orderBy, query } from "firebase/firestore";

import { db } from "./config";

import type { Photo } from "@/types/photo";

export async function getPhotos(
	deviceId: string,
	collectionId: string,
): Promise<Photo[]> {
	const photosRef = collection(
		db,
		"devices",
		deviceId,
		"collections",
		collectionId,
		"images",
	);

	const snapshot = await getDocs(
		query(photosRef, orderBy("createdAt", "desc")),
	);

	return snapshot.docs.map((document) => ({
		id: document.id,
		...document.data(),
	})) as Photo[];
}
