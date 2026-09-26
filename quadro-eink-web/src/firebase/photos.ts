import {
	collection,
	doc,
	serverTimestamp,
	setDoc,
	Timestamp,
} from "firebase/firestore";

import { ref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "./config";

type UploadTemporaryPhotoParams = {
	deviceId: string;

	preview: Blob;
	bin: Blob | Uint8Array;

	width: number;
	height: number;

	expiresAt: Date;
};

export async function uploadTemporaryPhoto({
	deviceId,

	preview,
	bin,

	width,
	height,

	expiresAt,
}: UploadTemporaryPhotoParams): Promise<string> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error("Usuário não autenticado.");
	}

	/*
	 * Gera o mesmo tipo de ID usado
	 * pelo aplicativo mobile.
	 *
	 * O documento ainda NÃO é criado.
	 */
	const photoRef = doc(
		collection(db, "devices", deviceId, "temporaryPhotos"),
	);

	const photoId = photoRef.id;

	const basePath = `devices/${deviceId}` + `/temporaryPhotos/${user.uid}`;

	const previewPath = `${basePath}/${photoId}-preview.png`;

	const epaperFilePath = `${basePath}/${photoId}-display.bin`;

	/*
	 * Primeiro fazemos os dois uploads.
	 */
	await Promise.all([
		uploadBytes(ref(storage, previewPath), preview, {
			contentType: "image/png",
		}),

		uploadBytes(ref(storage, epaperFilePath), bin, {
			contentType: "application/octet-stream",
		}),
	]);

	/*
	 * Só depois criamos o documento.
	 *
	 * A estrutura é propositalmente
	 * idêntica à do aplicativo mobile.
	 */
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
