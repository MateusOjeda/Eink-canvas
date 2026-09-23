import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { File, Paths } from "expo-file-system";

import { DisplayOrientation } from "@/types/display";

export default function AddPhotoScreen() {
	const [imageUri, setImageUri] = useState<string | null>(null);
	const [imageWidth, setImageWidth] = useState<number | null>(null);
	const [imageHeight, setImageHeight] = useState<number | null>(null);

	const [orientation, setOrientation] =
		useState<DisplayOrientation>("portrait");

	const pickImage = async () => {
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsEditing: false,
			quality: 1,
		});

		if (result.canceled) {
			return;
		}

		const image = result.assets[0];

		const sourceFile = new File(image.uri);

		const copiedFile = new File(
			Paths.cache,
			`selected-${Date.now()}${sourceFile.extension || ".jpg"}`,
		);

		await sourceFile.copy(copiedFile);

		setImageUri(copiedFile.uri);

		setImageWidth(image.width);
		setImageHeight(image.height);

		console.log("Imagem copiada:", copiedFile.uri);

		console.log("Imagem selecionada:", {
			uri: image.uri,
			width: image.width,
			height: image.height,
			fileName: image.fileName,
			fileSize: image.fileSize,
		});
	};

	const continueToCrop = () => {
		if (!imageUri || !imageWidth || !imageHeight) {
			return;
		}

		router.push({
			pathname: "/crop-photo",
			params: {
				fileName: Paths.basename(imageUri),
				imageWidth: imageWidth.toString(),
				imageHeight: imageHeight.toString(),
				orientation,
			},
		});
	};

	return (
		<View style={styles.container}>
			<View style={styles.content}>
				{imageUri ? (
					<Image
						source={{ uri: imageUri }}
						style={styles.image}
						resizeMode="contain"
					/>
				) : (
					<View style={styles.placeholder}>
						<Text style={styles.placeholderText}>
							Nenhuma foto selecionada
						</Text>
					</View>
				)}
			</View>

			{imageUri && (
				<View style={styles.orientationSection}>
					<Text style={styles.label}>Orientação no quadro</Text>

					<View style={styles.orientationButtons}>
						<Pressable
							style={[
								styles.orientationButton,
								orientation === "portrait" &&
									styles.orientationButtonSelected,
							]}
							onPress={() => setOrientation("portrait")}
						>
							<Text
								style={[
									styles.orientationText,
									orientation === "portrait" &&
										styles.orientationTextSelected,
								]}
							>
								Retrato
							</Text>
						</Pressable>

						<Pressable
							style={[
								styles.orientationButton,
								orientation === "landscape" &&
									styles.orientationButtonSelected,
							]}
							onPress={() => setOrientation("landscape")}
						>
							<Text
								style={[
									styles.orientationText,
									orientation === "landscape" &&
										styles.orientationTextSelected,
								]}
							>
								Paisagem
							</Text>
						</Pressable>
					</View>
				</View>
			)}

			<Pressable style={styles.secondaryButton} onPress={pickImage}>
				<Text style={styles.secondaryButtonText}>
					{imageUri ? "Escolher outra foto" : "Escolher foto"}
				</Text>
			</Pressable>

			{imageUri && (
				<Pressable style={styles.button} onPress={continueToCrop}>
					<Text style={styles.buttonText}>Continuar</Text>
				</Pressable>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#ffffff",
		padding: 24,
	},

	content: {
		flex: 1,
		justifyContent: "center",
	},

	placeholder: {
		height: 350,
		borderWidth: 1,
		borderColor: "#cccccc",
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},

	placeholderText: {
		color: "#777777",
		fontSize: 16,
	},

	image: {
		width: "100%",
		height: 400,
	},

	orientationSection: {
		marginBottom: 20,
	},

	label: {
		fontSize: 15,
		fontWeight: "600",
		marginBottom: 10,
	},

	orientationButtons: {
		flexDirection: "row",
		gap: 10,
	},

	orientationButton: {
		flex: 1,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: "#cccccc",
		borderRadius: 10,
		alignItems: "center",
	},

	orientationButtonSelected: {
		backgroundColor: "#111111",
		borderColor: "#111111",
	},

	orientationText: {
		fontSize: 15,
		color: "#111111",
	},

	orientationTextSelected: {
		color: "#ffffff",
	},

	secondaryButton: {
		paddingVertical: 16,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#111111",
		alignItems: "center",
		marginBottom: 10,
	},

	secondaryButtonText: {
		color: "#111111",
		fontSize: 16,
		fontWeight: "600",
	},

	button: {
		paddingVertical: 16,
		borderRadius: 12,
		backgroundColor: "#111111",
		alignItems: "center",
	},

	buttonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
});
