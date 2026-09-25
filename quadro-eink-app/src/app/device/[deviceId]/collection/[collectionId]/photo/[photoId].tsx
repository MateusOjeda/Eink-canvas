import { useEffect, useState, useCallback } from "react";

import {
	ActivityIndicator,
	Alert,
	Image,
	Pressable,
	StyleSheet,
	Switch,
	Text,
	View,
} from "react-native";

import {
	router,
	Stack,
	useLocalSearchParams,
	useFocusEffect,
} from "expo-router";

import { Feather, Ionicons } from "@expo/vector-icons";

import { deletePhoto, getPhoto, setPhotoActive } from "@/firebase/photos";

import { getStorageAuthHeaders, getStorageFileUrl } from "@/firebase/storage";

import type { Photo } from "@/types/photo";

import { getDevice } from "@/firebase/devices";

import type { Device } from "@/types/device";

export default function PhotoScreen() {
	const { deviceId, collectionId, photoId } = useLocalSearchParams<{
		deviceId: string;
		collectionId: string;
		photoId: string;
	}>();

	const [device, setDevice] = useState<Device | null>(null);

	const [photo, setPhoto] = useState<Photo | null>(null);

	const [loading, setLoading] = useState(true);

	const [updatingActive, setUpdatingActive] = useState(false);

	const [storageHeaders, setStorageHeaders] = useState<Record<
		string,
		string
	> | null>(null);

	useFocusEffect(
		useCallback(() => {
			const load = async () => {
				{
					try {
						const [
							loadedPhoto,
							loadedDevice,
							loadedStorageHeaders,
						] = await Promise.all([
							getPhoto(deviceId, collectionId, photoId),

							getDevice(deviceId),

							getStorageAuthHeaders(),
						]);

						if (!loadedPhoto) {
							Alert.alert("Foto não encontrada");

							router.back();
							return;
						}

						if (!loadedDevice) {
							Alert.alert("Quadro não encontrado");

							router.back();
							return;
						}

						setPhoto(loadedPhoto);
						setDevice(loadedDevice);
						setStorageHeaders(loadedStorageHeaders);
					} catch (error) {
						console.error("Erro ao carregar foto:", error);

						Alert.alert(
							"Erro",
							"Não foi possível carregar a foto.",
						);
					} finally {
						setLoading(false);
					}
				}
			};

			load();
		}, [deviceId, collectionId, photoId]),
	);

	const handleActiveChange = async (active: boolean) => {
		if (!photo || updatingActive) {
			return;
		}

		try {
			setUpdatingActive(true);

			await setPhotoActive(deviceId, collectionId, photo.id, active);

			setPhoto({
				...photo,
				active,
			});
		} catch (error) {
			console.error("Erro ao alterar estado da foto:", error);

			Alert.alert("Erro", "Não foi possível alterar a foto.");
		} finally {
			setUpdatingActive(false);
		}
	};

	const handleDelete = () => {
		if (!photo) {
			return;
		}

		Alert.alert(
			"Excluir foto",
			"Esta foto será removida permanentemente.",
			[
				{
					text: "Cancelar",
					style: "cancel",
				},

				{
					text: "Excluir",
					style: "destructive",

					onPress: async () => {
						try {
							await deletePhoto(deviceId, collectionId, photo);

							router.back();
						} catch (error) {
							console.error("Erro ao excluir foto:", error);

							Alert.alert(
								"Erro",
								"Não foi possível excluir a foto.",
							);
						}
					},
				},
			],
		);
	};

	if (loading) {
		return (
			<View style={styles.loading}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (!photo) {
		return null;
	}

	const photoOrientation =
		photo.height > photo.width ? "portrait" : "landscape";

	const orientationMismatch =
		device !== null && photoOrientation !== device.orientation;

	const previewUrl = getStorageFileUrl(photo.previewPath);

	return (
		<>
			<Stack.Screen
				options={{
					title: "Foto",

					headerRight: () => (
						<Pressable onPress={handleDelete} hitSlop={12}>
							<Ionicons
								name="trash-outline"
								size={21}
								color="#666666"
							/>
						</Pressable>
					),
				}}
			/>

			<View style={styles.container}>
				<View style={styles.previewContainer}>
					<Image
						source={{
							uri: previewUrl,
							headers: storageHeaders ?? undefined,
						}}
						style={styles.preview}
						resizeMode="contain"
					/>
				</View>

				{orientationMismatch && (
					<View style={styles.orientationWarning}>
						<Ionicons
							name="warning-outline"
							size={20}
							color="#7a5a00"
						/>

						<Text style={styles.orientationWarningText}>
							Esta foto está em{" "}
							{photoOrientation === "portrait"
								? "modo retrato"
								: "modo paisagem"}
							, mas o quadro está configurado para{" "}
							{device?.orientation === "portrait"
								? "retrato"
								: "paisagem"}
							. Ela não será exibida.
						</Text>
					</View>
				)}

				<View style={styles.descriptionSection}>
					<View style={styles.descriptionHeader}>
						<Text style={styles.descriptionTitle}>Descrição</Text>

						<Pressable
							style={styles.descriptionEditButton}
							onPress={() =>
								router.push({
									pathname:
										"/device/[deviceId]/collection/[collectionId]/photo/[photoId]/description",

									params: {
										deviceId,
										collectionId,
										photoId,
									},
								})
							}
						>
							<Feather
								name={photo.description ? "edit" : "plus"}
								size={22}
								color="#333333"
							/>
						</Pressable>
					</View>

					{photo.description ? (
						<Text style={styles.descriptionText}>
							{photo.description}
						</Text>
					) : (
						<Text style={styles.noDescription}>
							Nenhuma descrição
						</Text>
					)}
				</View>

				<View style={styles.option}>
					<View>
						<Text style={styles.optionTitle}>Foto ativa</Text>

						<Text style={styles.optionDescription}>
							Fotos desativadas não serão mostradas pelo quadro.
						</Text>
					</View>

					<Switch
						value={photo.active}
						disabled={updatingActive}
						onValueChange={handleActiveChange}
					/>
				</View>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,

		backgroundColor: "#ffffff",

		padding: 24,
	},

	loading: {
		flex: 1,

		backgroundColor: "#ffffff",

		justifyContent: "center",

		alignItems: "center",
	},

	previewContainer: {
		flex: 1,

		backgroundColor: "#f2f2f2",

		borderRadius: 12,

		overflow: "hidden",

		justifyContent: "center",

		alignItems: "center",
	},

	preview: {
		width: "100%",
		height: "100%",
	},

	option: {
		marginTop: 24,

		flexDirection: "row",

		alignItems: "center",

		justifyContent: "space-between",

		gap: 20,
	},

	optionTitle: {
		fontSize: 16,

		fontWeight: "600",
	},

	optionDescription: {
		marginTop: 4,

		maxWidth: 260,

		fontSize: 13,

		lineHeight: 18,

		color: "#666666",
	},
	orientationWarning: {
		marginTop: 20,

		flexDirection: "row",
		alignItems: "flex-start",

		gap: 10,

		padding: 14,

		borderRadius: 10,

		backgroundColor: "#fff6d8",
	},

	orientationWarningText: {
		flex: 1,

		fontSize: 13,
		lineHeight: 18,

		color: "#604800",
	},
	descriptionSection: {
		marginTop: 28,

		borderWidth: 1,
		borderColor: "#e2e2e2",
		borderRadius: 12,

		padding: 16,

		backgroundColor: "#ffffff",
	},

	descriptionHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},

	descriptionTitle: {
		fontSize: 16,
		fontWeight: "600",
	},

	descriptionEditButton: {
		width: 36,
		height: 36,

		alignItems: "center",
		justifyContent: "center",

		borderRadius: 18,
	},

	descriptionText: {
		marginTop: 10,

		fontSize: 15,
		lineHeight: 21,

		color: "#333333",
	},

	noDescription: {
		marginTop: 10,

		fontSize: 14,

		color: "#888888",
	},
});
