import {
	Alert,
	Image,
	Pressable,
	StyleSheet,
	Text,
	View,
	TextInput,
} from "react-native";

import { useState } from "react";

import { router, useLocalSearchParams } from "expo-router";

import { Directory, File, Paths } from "expo-file-system";

import { savePhoto } from "@/firebase/photos";

import { MAX_PHOTO_DESCRIPTION_LENGTH } from "@/constants/constants";

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

	const [description, setDescription] = useState("");

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

				description,
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

			<View style={styles.descriptionSection}>
				<Text style={styles.descriptionLabel}>Descrição</Text>

				<TextInput
					value={description}
					onChangeText={setDescription}
					multiline
					maxLength={MAX_PHOTO_DESCRIPTION_LENGTH}
					textAlignVertical="top"
					placeholder="Quem está na foto? O que aconteceu? O que você quer lembrar?"
					style={styles.descriptionInput}
				/>

				<Text style={styles.descriptionCounter}>
					{description.length} / {MAX_PHOTO_DESCRIPTION_LENGTH}
				</Text>
			</View>

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
		paddingVertical: 14,

		borderWidth: 1,

		borderColor: "#111111",

		borderRadius: 12,

		alignItems: "center",

		marginBottom: 10,
	},

	secondaryButtonText: {
		color: "#6b6b6b",

		fontSize: 16,

		fontWeight: "600",
	},

	primaryButton: {
		paddingVertical: 14,

		backgroundColor: "#6b6b6b",

		borderRadius: 12,

		alignItems: "center",
	},

	primaryButtonText: {
		color: "#ffffff",

		fontSize: 16,

		fontWeight: "600",
	},
	descriptionSection: {
		marginTop: 20,
	},

	descriptionLabel: {
		fontSize: 15,
		fontWeight: "600",
		marginBottom: 8,
	},

	descriptionInput: {
		minHeight: 110,

		borderWidth: 1,
		borderColor: "#cccccc",
		borderRadius: 12,

		padding: 14,

		fontSize: 15,
		lineHeight: 21,

		backgroundColor: "#ffffff",
	},

	descriptionCounter: {
		marginTop: 6,

		textAlign: "right",

		fontSize: 12,
		color: "#777777",
	},
});
