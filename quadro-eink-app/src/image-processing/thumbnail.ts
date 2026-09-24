import { File, Paths } from "expo-file-system";

import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const THUMBNAIL_MAX_SIZE = 300;

export async function createThumbnail(
	uri: string,
	width: number,
	height: number,
) {
	const scale = THUMBNAIL_MAX_SIZE / Math.max(width, height);

	const thumbnailWidth = Math.round(width * scale);

	const thumbnailHeight = Math.round(height * scale);

	const context = ImageManipulator.manipulate(uri);

	context.resize({
		width: thumbnailWidth,
		height: thumbnailHeight,
	});

	const renderedImage = await context.renderAsync();

	const temporaryThumbnail = await renderedImage.saveAsync({
		format: SaveFormat.JPEG,
		compress: 0.8,
	});

	/*
	 * O ImageManipulator pode salvar em uma
	 * subpasta própria do cache.
	 *
	 * Copiamos para a raiz de Paths.cache
	 * porque passamos somente o nome do arquivo
	 * entre as telas.
	 */
	const sourceFile = new File(temporaryThumbnail.uri);

	const thumbnailFile = new File(Paths.cache, `thumbnail-${Date.now()}.jpg`);

	await sourceFile.copy(thumbnailFile);

	return {
		uri: thumbnailFile.uri,
		width: thumbnailWidth,
		height: thumbnailHeight,
	};
}
