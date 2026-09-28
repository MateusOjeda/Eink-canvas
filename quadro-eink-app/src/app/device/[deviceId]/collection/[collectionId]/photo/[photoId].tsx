import { useCallback, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Image,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

import {
	router,
	Stack,
	useFocusEffect,
	useLocalSearchParams,
} from "expo-router";

import { Feather, Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { AppSwitch } from "@/components/ui/AppSwitch";

import { colors, radius, spacing, typography } from "@/theme";

import { deletePhoto, getPhoto, setPhotoActive } from "@/firebase/photos";

import { getCachedStorageFileUri } from "@/firebase/storage";
import { getDevice } from "@/firebase/devices";
import { getPhotoCollection } from "@/firebase/collections";

import type { Photo } from "@/types/photo";
import type { Device } from "@/types/device";
import type { PhotoCollection } from "@/types/photo-collection";

export default function PhotoScreen() {
	const { deviceId, collectionId, photoId } = useLocalSearchParams<{
		deviceId: string;
		collectionId: string;
		photoId: string;
	}>();

	const [device, setDevice] = useState<Device | null>(null);

	const [photoCollection, setPhotoCollection] =
		useState<PhotoCollection | null>(null);

	const [photo, setPhoto] = useState<Photo | null>(null);

	const [loading, setLoading] = useState(true);

	const [updatingActive, setUpdatingActive] = useState(false);

	const [deleting, setDeleting] = useState(false);

	const [previewUri, setPreviewUri] = useState<string | null>(null);

	useFocusEffect(
		useCallback(() => {
			const load = async () => {
				try {
					setLoading(true);

					const [loadedPhoto, loadedDevice, loadedCollection] =
						await Promise.all([
							getPhoto(deviceId, collectionId, photoId),
							getDevice(deviceId),
							getPhotoCollection(deviceId, collectionId),
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

					const loadedPreviewUri = await getCachedStorageFileUri(
						loadedPhoto.previewPath,
					);

					setPhoto(loadedPhoto);
					setDevice(loadedDevice);
					setPhotoCollection(loadedCollection);
					setPreviewUri(loadedPreviewUri);
				} catch (error) {
					console.error("Erro ao carregar foto:", error);

					Alert.alert("Erro", "Não foi possível carregar a foto.");
				} finally {
					setLoading(false);
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

	const handleEditDescription = () => {
		router.push({
			pathname:
				"/device/[deviceId]/collection/[collectionId]/photo/[photoId]/description",

			params: {
				deviceId,
				collectionId,
				photoId,
			},
		});
	};

	const handleDelete = () => {
		if (!photo || deleting) {
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
							setDeleting(true);

							await deletePhoto(deviceId, collectionId, photo);

							router.back();
						} catch (error) {
							console.error("Erro ao excluir foto:", error);

							Alert.alert(
								"Erro",
								"Não foi possível excluir a foto.",
							);

							setDeleting(false);
						}
					},
				},
			],
		);
	};

	if (loading) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />

				<View style={styles.loading}>
					<ActivityIndicator size="large" color={colors.primary} />
				</View>
			</>
		);
	}

	if (!photo) {
		return null;
	}

	const photoOrientation =
		photo.height > photo.width ? "portrait" : "landscape";

	const orientationMismatch =
		device !== null && photoOrientation !== device.orientation;

	const previewAspectRatio = photo.width / photo.height;

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<Screen scroll>
				<ScreenHeader
					title="Foto"
					subtitle={[photoCollection?.name, device?.name]
						.filter(Boolean)
						.join(" · ")}
					showBackButton
				/>

				{previewUri ? (
					<View style={styles.previewArea}>
						<Image
							source={{ uri: previewUri }}
							style={
								photoOrientation === "portrait"
									? [
											styles.previewPortrait,
											{
												aspectRatio: previewAspectRatio,
											},
										]
									: [
											styles.previewLandscape,
											{
												aspectRatio: previewAspectRatio,
											},
										]
							}
							resizeMode="contain"
						/>
					</View>
				) : null}

				{orientationMismatch ? (
					<View style={styles.orientationWarning}>
						<Ionicons
							name="warning-outline"
							size={20}
							color={colors.textSecondary}
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
				) : null}

				<View style={styles.activeRow}>
					<Text style={styles.activeTitle}>Foto ativa</Text>

					<AppSwitch
						value={photo.active}
						disabled={updatingActive}
						onValueChange={handleActiveChange}
					/>
				</View>

				<Text style={styles.sectionTitle}>Descrição</Text>

				<Pressable
					style={({ pressed }) => [
						styles.descriptionCard,
						pressed && styles.pressed,
					]}
					onPress={handleEditDescription}
				>
					<Text
						style={[
							styles.descriptionText,
							!photo.description && styles.descriptionPlaceholder,
						]}
						numberOfLines={3}
					>
						{photo.description || "Nenhuma descrição"}
					</Text>

					<Feather
						name="edit-2"
						size={21}
						color={colors.textSecondary}
					/>
				</Pressable>

				<Pressable
					disabled={deleting}
					onPress={handleDelete}
					style={({ pressed }) => [
						styles.deleteButton,
						pressed && !deleting && styles.pressed,
						deleting && styles.deleteButtonDisabled,
					]}
				>
					{deleting ? (
						<ActivityIndicator size="small" color={colors.danger} />
					) : (
						<Text style={styles.deleteButtonText}>
							Excluir foto
						</Text>
					)}
				</Pressable>
			</Screen>
		</>
	);
}

const styles = StyleSheet.create({
	loading: {
		flex: 1,
		backgroundColor: colors.background,
		alignItems: "center",
		justifyContent: "center",
	},

	pressed: {
		opacity: 0.72,
	},

	previewArea: {
		alignItems: "center",
		justifyContent: "center",
	},

	previewLandscape: {
		width: "100%",
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
	},

	previewPortrait: {
		height: 380,
		maxWidth: "100%",
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
	},

	orientationWarning: {
		marginTop: spacing.lg,
		padding: spacing.md,
		borderRadius: radius.lg,
		backgroundColor: colors.surfaceMuted,
		flexDirection: "row",
		alignItems: "flex-start",
		gap: spacing.sm,
	},

	orientationWarningText: {
		flex: 1,
		...typography.metadata,
		color: colors.textSecondary,
	},

	activeRow: {
		marginTop: spacing.xl,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},

	activeTitle: {
		...typography.cardTitle,
		color: colors.text,
	},

	sectionTitle: {
		marginTop: spacing.xxl,
		marginBottom: spacing.sm,
		...typography.sectionTitle,
		fontSize: 20,
		lineHeight: 26,
		color: colors.text,
	},

	descriptionCard: {
		minHeight: 66,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
	},

	descriptionText: {
		flex: 1,
		...typography.body,
		color: colors.textSecondary,
	},

	descriptionPlaceholder: {
		color: colors.textMuted,
	},

	deleteButton: {
		minHeight: 52,
		marginTop: spacing.xl,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		alignItems: "center",
		justifyContent: "center",
	},

	deleteButtonDisabled: {
		opacity: 0.5,
	},

	deleteButtonText: {
		...typography.button,
		color: colors.danger,
	},
});
