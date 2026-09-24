import {
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	updateDoc,
} from "firebase/firestore";

import { deleteStorageFile, uploadLocalFile } from "./storage";

import { db } from "./config";

import type { Photo } from "@/types/photo";

type SavePhotoParams = {
	deviceId: string;
	collectionId: string;

	previewUri: string;
	thumbnailUri: string;
	binUri: string;

	width: number;
	height: number;
};

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

function getOriginalExtension(uri: string): string {
	const cleanUri = uri.split("?")[0];

	const lastDot = cleanUri.lastIndexOf(".");

	if (lastDot === -1) {
		return ".jpg";
	}

	const extension = cleanUri.substring(lastDot).toLowerCase();

	if (
		[".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"].includes(extension)
	) {
		return extension;
	}

	return ".jpg";
}

export async function savePhoto({
	deviceId,
	collectionId,

	previewUri,
	thumbnailUri,
	binUri,

	width,
	height,
}: SavePhotoParams): Promise<string> {
	/*
	 * Gera um ID do Firestore,
	 * mas ainda NÃO cria o documento.
	 */
	const imageRef = doc(
		collection(
			db,
			"devices",
			deviceId,
			"collections",
			collectionId,
			"images",
		),
	);

	const imageId = imageRef.id;

	const basePath =
		`devices/${deviceId}` +
		`/collections/${collectionId}` +
		`/images/${imageId}`;

	const previewPath = `${basePath}/preview.png`;

	const thumbnailPath = `${basePath}/thumbnail.jpg`;

	const epaperFilePath = `${basePath}/display.bin`;

	/*
	 * Fazemos primeiro todos os uploads.
	 *
	 * O documento do Firestore só será
	 * criado se os quatro terminarem.
	 */
	await Promise.all([
		uploadLocalFile(previewUri, previewPath, "image/png"),

		uploadLocalFile(thumbnailUri, thumbnailPath, "image/jpeg"),

		uploadLocalFile(binUri, epaperFilePath, "application/octet-stream"),
	]);

	/*
	 * Só agora a imagem passa a existir
	 * oficialmente no banco.
	 */
	await setDoc(imageRef, {
		active: true,

		previewPath,
		thumbnailPath,
		epaperFilePath,

		width,
		height,

		createdAt: serverTimestamp(),
	});

	return imageId;
}

export async function getPhoto(
	deviceId: string,
	collectionId: string,
	photoId: string,
): Promise<Photo | null> {
	const photoRef = doc(
		db,
		"devices",
		deviceId,
		"collections",
		collectionId,
		"images",
		photoId,
	);

	const snapshot = await getDoc(photoRef);

	if (!snapshot.exists()) {
		return null;
	}

	return {
		id: snapshot.id,
		...snapshot.data(),
	} as Photo;
}

export async function setPhotoActive(
	deviceId: string,
	collectionId: string,
	photoId: string,
	active: boolean,
): Promise<void> {
	await updateDoc(
		doc(
			db,
			"devices",
			deviceId,
			"collections",
			collectionId,
			"images",
			photoId,
		),
		{
			active,
		},
	);
}

export async function deletePhoto(
	deviceId: string,
	collectionId: string,
	photo: Photo,
): Promise<void> {
	/*
	 * Primeiro removemos os arquivos.
	 *
	 * Só depois apagamos o documento,
	 * para não perdermos os paths caso
	 * algum delete falhe.
	 */
	await Promise.all([
		deleteStorageFile(photo.previewPath),

		deleteStorageFile(photo.thumbnailPath),

		deleteStorageFile(photo.epaperFilePath),
	]);

	await deleteDoc(
		doc(
			db,
			"devices",
			deviceId,
			"collections",
			collectionId,
			"images",
			photo.id,
		),
	);
}
