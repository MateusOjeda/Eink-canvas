import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useState } from "react";

import { router, useLocalSearchParams } from "expo-router";

import { Directory, File, Paths } from "expo-file-system";

import { uploadLocalFile } from "@/firebase/storage";

import { savePhoto } from "@/firebase/photos";

export default function PreviewPhotoScreen() {
	const params = useLocalSearchParams<{
		deviceId: string;
		collectionId: string;

		fileName: string;
		thumbnailFileName: string;
		binFileName: string;

		imageWidth: string;
		imageHeight: string;
	}>();

	const [saving, setSaving] = useState(false);

	const imageWidth = Number(params.imageWidth);

	const imageHeight = Number(params.imageHeight);

	/*
	 * Reconstrói as URIs a partir dos
	 * nomes enviados pelo crop-photo.
	 */
	const previewUri = Paths.join(Paths.cache, params.fileName);

	const thumbnailUri = Paths.join(Paths.cache, params.thumbnailFileName);

	const binUri = Paths.join(Paths.cache, params.binFileName);

	/*
	 * Salva o .bin em uma pasta
	 * escolhida pelo usuário.
	 */
	const downloadBin = async () => {
		try {
			const sourceFile = new File(binUri);

			if (!sourceFile.exists) {
				throw new Error("Arquivo .bin não encontrado.");
			}

			/*
			 * Abre o seletor de pastas
			 * do sistema.
			 *
			 * No Android, normalmente
			 * você pode escolher Downloads,
			 * Documents etc.
			 */
			const destinationDirectory = await Directory.pickDirectoryAsync();

			const outputName = `quadro-eink-${imageWidth}x${imageHeight}-${Date.now()}.bin`;

			/*
			 * Cria o arquivo na pasta
			 * escolhida pelo usuário.
			 */
			const outputFile = destinationDirectory.createFile(
				outputName,
				"application/octet-stream",
			);

			/*
			 * O arquivo atualmente tem:
			 *
			 * 4 bits por pixel
			 * 2 pixels por byte.
			 */
			const bytes = await sourceFile.bytes();

			await outputFile.write(bytes);

			Alert.alert(
				"Arquivo salvo",
				`${outputName}\n\n${bytes.length.toLocaleString()} bytes`,
			);
		} catch (error) {
			/*
			 * O cancelamento do seletor
			 * também pode cair aqui.
			 */
			console.log("Download do .bin cancelado ou falhou:", error);
		}
	};

	const useImage = async () => {
		try {
			setSaving(true);

			await savePhoto({
				deviceId: params.deviceId,

				collectionId: params.collectionId,

				previewUri,
				thumbnailUri,
				binUri,

				width: Number(params.imageWidth),

				height: Number(params.imageHeight),
			});

			router.dismissTo({
				pathname: "/device/[deviceId]/collection/[collectionId]",

				params: {
					deviceId: params.deviceId,

					collectionId: params.collectionId,
				},
			});
		} catch (error) {
			console.error("Erro ao salvar imagem:", error);

			Alert.alert("Erro", "Não foi possível salvar a imagem.");
		} finally {
			setSaving(false);
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Prévia Spectra 6</Text>

			<Text style={styles.resolution}>
				{imageWidth} × {imageHeight}
			</Text>

			<View style={styles.previewContainer}>
				<Image
					source={{
						uri: previewUri,
					}}
					style={[
						styles.image,

						{
							aspectRatio: imageWidth / imageHeight,
						},
					]}
					resizeMode="contain"
				/>
			</View>

			<Text style={styles.hint}>
				Esta é a imagem já convertida para as cores da tela.
			</Text>

			<Pressable
				style={styles.secondaryButton}
				onPress={() => router.back()}
			>
				<Text style={styles.secondaryButtonText}>Voltar e ajustar</Text>
			</Pressable>

			<Pressable style={styles.secondaryButton} onPress={downloadBin}>
				<Text style={styles.secondaryButtonText}>Baixar .bin</Text>
			</Pressable>

			<Pressable
				disabled={saving}
				style={[
					styles.primaryButton,
					saving && {
						opacity: 0.5,
					},
				]}
				onPress={useImage}
			>
				<Text style={styles.primaryButtonText}>
					{saving ? "Salvando..." : "Usar imagem"}
				</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,

		backgroundColor: "#ffffff",

		padding: 24,
	},

	title: {
		fontSize: 22,

		fontWeight: "600",

		textAlign: "center",
	},

	resolution: {
		marginTop: 6,

		fontSize: 14,

		color: "#666666",

		textAlign: "center",
	},

	previewContainer: {
		flex: 1,

		alignItems: "center",

		justifyContent: "center",
	},

	image: {
		width: "100%",

		maxHeight: "100%",
	},

	hint: {
		fontSize: 14,

		color: "#666666",

		textAlign: "center",

		marginBottom: 20,
	},

	secondaryButton: {
		paddingVertical: 16,

		borderWidth: 1,

		borderColor: "#111111",

		borderRadius: 12,

		alignItems: "center",

		marginBottom: 10,
	},

	secondaryButtonText: {
		color: "#111111",

		fontSize: 16,

		fontWeight: "600",
	},

	primaryButton: {
		paddingVertical: 16,

		backgroundColor: "#111111",

		borderRadius: 12,

		alignItems: "center",
	},

	primaryButtonText: {
		color: "#ffffff",

		fontSize: 16,

		fontWeight: "600",
	},
});
