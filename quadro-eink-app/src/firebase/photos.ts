import {
	collection,
	deleteDoc,
	deleteField,
	doc,
	getDoc,
	getDocs,
	orderBy,
	query,
	serverTimestamp,
	setDoc,
	Timestamp,
	updateDoc,
} from "firebase/firestore";

import { deleteStorageFile, uploadLocalFile } from "./storage";

import { auth, db } from "./config";

import type { Photo, TemporaryPhoto } from "@/types/photo";

type SavePhotoParams = {
	deviceId: string;
	collectionId: string;

	previewUri: string;
	thumbnailUri: string;
	binUri: string;

	width: number;
	height: number;

	description?: string;
};

type UploadTemporaryPhotoParams = {
	deviceId: string;

	previewUri: string;
	binUri: string;

	width: number;
	height: number;

	expiresAt: Date;
};

export async function getTemporaryPhotos(
	deviceId: string,
): Promise<TemporaryPhoto[]> {
	const photosRef = collection(db, "devices", deviceId, "temporaryPhotos");

	const snapshot = await getDocs(
		query(photosRef, orderBy("createdAt", "desc")),
	);

	return snapshot.docs.map((document) => {
		const data = document.data();

		return {
			id: document.id,

			createdByUid: data.createdByUid,

			previewPath: data.previewPath,
			epaperFilePath: data.epaperFilePath,

			width: data.width,
			height: data.height,

			expiresAt: data.expiresAt.toDate(),
		};
	});
}

export async function deleteTemporaryPhoto(
	deviceId: string,
	photo: TemporaryPhoto,
): Promise<void> {
	/*
	 * Primeiro apagamos os arquivos.
	 *
	 * Só depois removemos o documento,
	 * para não perdermos os paths caso
	 * algum delete falhe.
	 */
	await Promise.all([
		deleteStorageFile(photo.previewPath),

		deleteStorageFile(photo.epaperFilePath),
	]);

	await deleteDoc(doc(db, "devices", deviceId, "temporaryPhotos", photo.id));
}

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

export async function savePhoto({
	deviceId,
	collectionId,

	previewUri,
	thumbnailUri,
	binUri,

	width,
	height,

	description,
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
	 * criado se os três terminarem.
	 */
	await Promise.all([
		uploadLocalFile(previewUri, previewPath, "image/png"),

		uploadLocalFile(thumbnailUri, thumbnailPath, "image/jpeg"),

		uploadLocalFile(binUri, epaperFilePath, "application/octet-stream"),
	]);

	const trimmedDescription = description?.trim();

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

		...(trimmedDescription
			? {
					description: trimmedDescription,
				}
			: {}),
	});

	return imageId;
}

export async function uploadTemporaryPhoto({
	deviceId,

	previewUri,
	binUri,

	width,
	height,

	expiresAt,
}: UploadTemporaryPhotoParams): Promise<string> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error("Usuário não autenticado.");
	}

	/*
	 * Gera um ID do Firestore,
	 * mas ainda NÃO cria o documento.
	 */
	const photoRef = doc(
		collection(db, "devices", deviceId, "temporaryPhotos"),
	);

	const photoId = photoRef.id;

	/*
	 * A estrutura do Storage precisa respeitar:
	 *
	 * devices/{deviceId}/temporaryPhotos/{uid}/{fileName}
	 *
	 * pois é esse o formato usado nas Storage Rules.
	 */
	const basePath = `devices/${deviceId}` + `/temporaryPhotos/${user.uid}`;

	const previewPath = `${basePath}/${photoId}-preview.png`;

	const epaperFilePath = `${basePath}/${photoId}-display.bin`;

	/*
	 * Primeiro enviamos os arquivos.
	 *
	 * O documento do Firestore só é criado
	 * quando os dois uploads terminarem.
	 */
	await Promise.all([
		uploadLocalFile(previewUri, previewPath, "image/png"),

		uploadLocalFile(binUri, epaperFilePath, "application/octet-stream"),
	]);

	await setDoc(photoRef, {
		createdByUid: user.uid,

		previewPath,
		epaperFilePath,

		width,
		height,

		expiresAt: Timestamp.fromDate(expiresAt),

		createdAt: serverTimestamp(),
	});

	return photoId;
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

export async function updatePhotoDescription(
	deviceId: string,
	collectionId: string,
	photoId: string,
	description: string,
): Promise<void> {
	const photoRef = doc(
		db,
		"devices",
		deviceId,
		"collections",
		collectionId,
		"images",
		photoId,
	);

	const trimmedDescription = description.trim();

	if (!trimmedDescription) {
		await updateDoc(photoRef, {
			description: deleteField(),
		});

		return;
	}

	await updateDoc(photoRef, {
		description: trimmedDescription,
	});
}
