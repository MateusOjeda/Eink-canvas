import { useState, useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { File, Paths } from "expo-file-system";

import { DisplayOrientation } from "@/types/display";

import { getDevice } from "@/firebase/devices";

export default function AddPhotoScreen() {
	const { deviceId, collectionId, mode } = useLocalSearchParams<{
		deviceId: string;
		collectionId?: string;
		mode?: "collection" | "temporary";
	}>();

	const photoMode = mode ?? "collection";

	const [imageUri, setImageUri] = useState<string | null>(null);
	const [imageWidth, setImageWidth] = useState<number | null>(null);
	const [imageHeight, setImageHeight] = useState<number | null>(null);

	const [orientation, setOrientation] = useState<DisplayOrientation | null>(
		null,
	);

	useEffect(() => {
		const loadDevice = async () => {
			const device = await getDevice(deviceId);

			if (device) {
				setOrientation(device.orientation);
			}
		};

		loadDevice();
	}, [deviceId]);

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
	};

	const continueToCrop = () => {
		if (!imageUri || !imageWidth || !imageHeight || !orientation) {
			return;
		}

		router.push({
			pathname: "/crop-photo",

			params: {
				deviceId,

				...(collectionId
					? {
							collectionId,
						}
					: {}),

				mode: photoMode,

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

			{imageUri && orientation && (
				<View style={styles.orientationSection}>
					<Text style={styles.label}>
						{photoMode === "temporary"
							? "Orientação do quadro"
							: "Orientação no quadro"}
					</Text>

					<View style={styles.orientationButtons}>
						<Pressable
							disabled={
								photoMode === "temporary" &&
								orientation !== "portrait"
							}
							style={[
								styles.orientationButton,

								orientation === "portrait" &&
									styles.orientationButtonSelected,

								photoMode === "temporary" &&
									orientation !== "portrait" &&
									styles.orientationButtonDisabled,
							]}
							onPress={() => {
								if (photoMode === "collection") {
									setOrientation("portrait");
								}
							}}
						>
							<Text
								style={[
									styles.orientationText,

									orientation === "portrait" &&
										styles.orientationTextSelected,

									photoMode === "temporary" &&
										orientation !== "portrait" &&
										styles.orientationTextDisabled,
								]}
							>
								Retrato
							</Text>
						</Pressable>

						<Pressable
							disabled={
								photoMode === "temporary" &&
								orientation !== "landscape"
							}
							style={[
								styles.orientationButton,

								orientation === "landscape" &&
									styles.orientationButtonSelected,

								photoMode === "temporary" &&
									orientation !== "landscape" &&
									styles.orientationButtonDisabled,
							]}
							onPress={() => {
								if (photoMode === "collection") {
									setOrientation("landscape");
								}
							}}
						>
							<Text
								style={[
									styles.orientationText,

									orientation === "landscape" &&
										styles.orientationTextSelected,

									photoMode === "temporary" &&
										orientation !== "landscape" &&
										styles.orientationTextDisabled,
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
		backgroundColor: "#6b6b6b",
		borderColor: "#6b6b6b",
	},

	orientationText: {
		fontSize: 15,
		color: "#111111",
	},

	orientationTextSelected: {
		color: "#ffffff",
	},

	secondaryButton: {
		paddingVertical: 14,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#6b6b6b",
		alignItems: "center",
		marginBottom: 10,
	},

	secondaryButtonText: {
		color: "#6b6b6b",
		fontSize: 16,
		fontWeight: "600",
	},

	button: {
		paddingVertical: 14,
		borderRadius: 12,
		backgroundColor: "#6b6b6b",
		alignItems: "center",
	},

	buttonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
	orientationButtonDisabled: {
		backgroundColor: "#f5f5f5",
		borderColor: "#dddddd",
	},

	orientationTextDisabled: {
		color: "#aaaaaa",
	},
});
