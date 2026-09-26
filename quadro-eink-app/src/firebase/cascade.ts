import { deleteDevice } from "./devices";

import { deletePhotoCollection, getCollections } from "./collections";

import {
	deletePhoto,
	deleteTemporaryPhoto,
	getPhotos,
	getTemporaryPhotos,
} from "./photos";

export async function deleteCollectionWithPhotos(
	deviceId: string,
	collectionId: string,
): Promise<void> {
	const photos = await getPhotos(deviceId, collectionId);

	/*
	 * Primeiro apagamos todas as fotos
	 * e seus respectivos arquivos do Storage.
	 */
	for (const photo of photos) {
		await deletePhoto(deviceId, collectionId, photo);
	}

	/*
	 * Só depois removemos a collection.
	 */
	await deletePhotoCollection(deviceId, collectionId);
}

export async function deleteDeviceWithContent(deviceId: string): Promise<void> {
	const collections = await getCollections(deviceId);

	/*
	 * Apaga collections normais,
	 * incluindo suas fotos e arquivos.
	 */
	for (const photoCollection of collections) {
		await deleteCollectionWithPhotos(deviceId, photoCollection.id);
	}

	/*
	 * Apaga todas as fotos temporárias,
	 * incluindo preview + display.bin
	 * no Storage.
	 */
	const temporaryPhotos = await getTemporaryPhotos(deviceId);

	for (const photo of temporaryPhotos) {
		await deleteTemporaryPhoto(deviceId, photo);
	}

	/*
	 * Neste ponto não deve mais existir
	 * conteúdo dependente do device.
	 */
	await deleteDevice(deviceId);
}
