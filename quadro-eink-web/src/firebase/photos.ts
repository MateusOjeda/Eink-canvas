import {
	collection,
	doc,
	serverTimestamp,
	setDoc,
	getDocs,
	limit,
	orderBy,
	query,
	startAfter,
	where,
	type DocumentData,
	type QueryDocumentSnapshot,
} from "firebase/firestore";

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { auth, db, storage } from "./config";

type UploadTemporaryPhotoParams = {
	deviceId: string;

	preview: Blob;
	bin: Blob | Uint8Array;

	width: number;
	height: number;

	durationMinutes: number;
};

export async function uploadTemporaryPhoto({
	deviceId,

	preview,
	bin,

	width,
	height,

	durationMinutes,
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
		createdByEmail: user.email,

		previewPath,
		epaperFilePath,

		width,
		height,

		recurrence: "once",

		durationMinutes,

		createdAt: serverTimestamp(),
	});

	return photoId;
}

export type TemporaryPhotoHistoryItem = {
	id: string;
	previewUrl: string;
	createdAt: Date | null;
	durationMinutes: number;
};

export type TemporaryPhotoHistoryPage = {
	items: TemporaryPhotoHistoryItem[];
	lastDoc: QueryDocumentSnapshot<DocumentData> | null;
	hasMore: boolean;
};

const HISTORY_PAGE_SIZE = 10;

export async function getTemporaryPhotoHistory(
	deviceId: string,
	lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<TemporaryPhotoHistoryPage> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error("Usuário não autenticado.");
	}

	const photosRef = collection(db, "devices", deviceId, "temporaryPhotos");

	const constraints = [
		where("createdByUid", "==", user.uid),
		orderBy("createdAt", "desc"),
		...(lastDoc ? [startAfter(lastDoc)] : []),
		limit(HISTORY_PAGE_SIZE + 1),
	];

	const snapshot = await getDocs(query(photosRef, ...constraints));

	const hasMore = snapshot.docs.length > HISTORY_PAGE_SIZE;
	const pageDocs = snapshot.docs.slice(0, HISTORY_PAGE_SIZE);

	const items = await Promise.all(
		pageDocs.map(async (photoDoc) => {
			const data = photoDoc.data();

			let previewUrl = "";

			if (data.previewPath) {
				try {
					previewUrl = await getDownloadURL(
						ref(storage, data.previewPath),
					);
				} catch (error) {
					console.error(
						`Erro ao carregar a prévia ${photoDoc.id}:`,
						error,
					);
				}
			}

			return {
				id: photoDoc.id,
				previewUrl,
				createdAt: data.createdAt?.toDate?.() ?? null,
				durationMinutes: data.durationMinutes ?? 0,
			};
		}),
	);

	return {
		items,
		lastDoc: pageDocs.at(-1) ?? null,
		hasMore,
	};
}
