import {
	collection,
	doc,
	getDocs,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
} from "firebase/firestore";

import { db } from "./config";

import { uploadLocalFile } from "./storage";

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
