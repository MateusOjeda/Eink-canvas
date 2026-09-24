import { deleteDevice } from "./devices";

import { deletePhotoCollection, getCollections } from "./collections";

import { deletePhoto, getPhotos } from "./photos";

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
	 * Cada collection é responsável por
	 * apagar suas próprias fotos antes
	 * de desaparecer.
	 */
	for (const photoCollection of collections) {
		await deleteCollectionWithPhotos(deviceId, photoCollection.id);
	}

	/*
	 * Só depois que tudo abaixo do Device
	 * foi removido, apagamos o Device.
	 */
	await deleteDevice(deviceId);
}
