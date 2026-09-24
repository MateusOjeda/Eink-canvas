import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	orderBy,
	query,
	serverTimestamp,
	updateDoc,
} from "firebase/firestore";

import { db } from "./config";

import type { PhotoCollection } from "@/types/photo-collection";

export async function getCollections(
	deviceId: string,
): Promise<PhotoCollection[]> {
	const collectionsRef = collection(db, "devices", deviceId, "collections");

	const snapshot = await getDocs(
		query(collectionsRef, orderBy("createdAt", "desc")),
	);

	return snapshot.docs.map((document) => ({
		id: document.id,
		name: document.data().name,
		active: document.data().active,
	}));
}

export async function getPhotoCollection(
	deviceId: string,
	collectionId: string,
): Promise<PhotoCollection | null> {
	const snapshot = await getDoc(
		doc(db, "devices", deviceId, "collections", collectionId),
	);

	if (!snapshot.exists()) {
		return null;
	}

	return {
		id: snapshot.id,
		name: snapshot.data().name,
		active: snapshot.data().active,
	};
}

export async function createPhotoCollection(
	deviceId: string,
	name: string,
): Promise<void> {
	await addDoc(collection(db, "devices", deviceId, "collections"), {
		name,
		active: true,
		createdAt: serverTimestamp(),
	});
}

export async function renamePhotoCollection(
	deviceId: string,
	collectionId: string,
	name: string,
): Promise<void> {
	await updateDoc(doc(db, "devices", deviceId, "collections", collectionId), {
		name,
	});
}

export async function setCollectionActive(
	deviceId: string,
	collectionId: string,
	active: boolean,
): Promise<void> {
	await updateDoc(doc(db, "devices", deviceId, "collections", collectionId), {
		active,
	});
}

export async function deletePhotoCollection(
	deviceId: string,
	collectionId: string,
): Promise<void> {
	await deleteDoc(doc(db, "devices", deviceId, "collections", collectionId));
}
