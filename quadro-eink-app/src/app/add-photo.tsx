import { useCallback, useEffect, useMemo, useState } from "react";

import {
	ActivityIndicator,
	Image,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import { router, Stack, useLocalSearchParams } from "expo-router";

import { File, Paths } from "expo-file-system";

import { Feather, Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, spacing, typography } from "@/theme";

import type { DisplayOrientation } from "@/types/display";

import { getDevice } from "@/firebase/devices";
import { getPhotoCollection } from "@/firebase/collections";

export default function AddPhotoScreen() {
	const { deviceId, collectionId, mode } = useLocalSearchParams<{
		deviceId: string;
		collectionId?: string;
		mode?: "collection" | "temporary";
	}>();

	const photoMode = mode ?? "collection";

	const [selectedImageUri, setSelectedImageUri] = useState<string | null>(
		null,
	);
	const [imageWidth, setImageWidth] = useState<number | null>(null);
	const [imageHeight, setImageHeight] = useState<number | null>(null);

	const [orientation, setOrientation] = useState<DisplayOrientation | null>(
		null,
	);

	const [deviceName, setDeviceName] = useState("");
	const [collectionName, setCollectionName] = useState("");

	const [loadingMeta, setLoadingMeta] = useState(true);
	const [pickingImage, setPickingImage] = useState(false);

	useEffect(() => {
		let isMounted = true;

		const loadContext = async () => {
			try {
				setLoadingMeta(true);

				const [device, collection] = await Promise.all([
					getDevice(deviceId),
					collectionId
						? getPhotoCollection(deviceId, collectionId)
						: Promise.resolve(null),
				]);

				if (!isMounted) {
					return;
				}

				if (device) {
					setDeviceName(device.name);
					setOrientation(device.orientation);
				}

				if (collection) {
					setCollectionName(collection.name);
				}
			} catch (error) {
				console.error("Erro ao carregar contexto da foto:", error);
			} finally {
				if (isMounted) {
					setLoadingMeta(false);
				}
			}
		};

		loadContext();

		return () => {
			isMounted = false;
		};
	}, [deviceId, collectionId]);

	const subtitle = useMemo(() => {
		if (photoMode === "collection") {
			return [collectionName, deviceName].filter(Boolean).join(" · ");
		}

		return deviceName;
	}, [collectionName, deviceName, photoMode]);

	const applyPickedImage = useCallback(
		async (image: ImagePicker.ImagePickerAsset) => {
			const sourceFile = new File(image.uri);

			const copiedFile = new File(
				Paths.cache,
				`selected-${Date.now()}${sourceFile.extension || ".jpg"}`,
			);

			await sourceFile.copy(copiedFile);

			// Usamos exatamente o arquivo em cache que será aberto
			// pela tela de crop. Assim preview e crop leem a mesma URI.
			setSelectedImageUri(copiedFile.uri);
			setImageWidth(image.width);
			setImageHeight(image.height);
		},
		[photoMode],
	);

	/*
	 * No Android, a Activity pode ser recriada enquanto
	 * o seletor de fotos está aberto. Nesse caso, o resultado
	 * não volta para a Promise original e precisa ser recuperado
	 * com getPendingResultAsync().
	 */
	useEffect(() => {
		let isMounted = true;

		const recoverPendingImage = async () => {
			try {
				const pendingResult = await ImagePicker.getPendingResultAsync();

				if (
					!isMounted ||
					!pendingResult ||
					!("assets" in pendingResult) ||
					pendingResult.canceled ||
					!pendingResult.assets?.length
				) {
					return;
				}

				await applyPickedImage(pendingResult.assets[0]);
			} catch (error) {
				console.error("Erro ao recuperar foto selecionada:", error);
			}
		};

		recoverPendingImage();

		return () => {
			isMounted = false;
		};
	}, [applyPickedImage]);

	const pickImage = async () => {
		try {
			setPickingImage(true);

			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ["images"],
				allowsEditing: false,
				quality: 1,
			});

			if (result.canceled) {
				return;
			}

			await applyPickedImage(result.assets[0]);
		} catch (error) {
			console.error("Erro ao selecionar foto:", error);
		} finally {
			setPickingImage(false);
		}
	};

	const clearImage = () => {
		setSelectedImageUri(null);
		setImageWidth(null);
		setImageHeight(null);
	};

	const continueToCrop = () => {
		if (!selectedImageUri || !imageWidth || !imageHeight || !orientation) {
			return;
		}

		router.push({
			pathname: "/crop-photo",
			params: {
				deviceId,

				...(collectionId ? { collectionId } : {}),

				mode: photoMode,

				fileName: Paths.basename(selectedImageUri),
				imageWidth: imageWidth.toString(),
				imageHeight: imageHeight.toString(),

				orientation,
			},
		});
	};

	const allowOrientationSelection = photoMode === "collection";

	const portraitDisabled =
		!allowOrientationSelection && orientation !== "portrait";

	const landscapeDisabled =
		!allowOrientationSelection && orientation !== "landscape";

	const isReadyToContinue =
		Boolean(selectedImageUri) &&
		Boolean(imageWidth) &&
		Boolean(imageHeight) &&
		Boolean(orientation);

	if (loadingMeta) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />

				<View style={styles.loading}>
					<ActivityIndicator size="large" color={colors.primary} />
				</View>
			</>
		);
	}

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<Screen contentContainerStyle={styles.screenContent}>
				<ScreenHeader
					title="Adicionar foto"
					subtitle={subtitle}
					showBackButton
				/>

				<View style={styles.body}>
					<View style={styles.content}>
						{selectedImageUri ? (
							<>
								<View style={styles.imageFrame}>
									{selectedImageUri &&
									imageWidth &&
									imageHeight ? (
										<Image
											source={{ uri: selectedImageUri }}
											style={[
												styles.image,
												{
													aspectRatio:
														imageWidth /
														imageHeight,
												},
											]}
											resizeMode="contain"
										/>
									) : null}
								</View>

								<Pressable
									onPress={clearImage}
									style={({ pressed }) => [
										styles.removeButton,
										pressed && styles.pressed,
									]}
									accessibilityRole="button"
									accessibilityLabel="Remover foto selecionada"
								>
									<Ionicons
										name="close"
										size={22}
										color={colors.white}
									/>
								</Pressable>

								<View style={styles.orientationRow}>
									<Pressable
										onPress={() =>
											allowOrientationSelection &&
											setOrientation("landscape")
										}
										disabled={landscapeDisabled}
										style={({ pressed }) => [
											styles.orientationButton,
											orientation === "landscape" &&
												styles.orientationButtonSelected,
											landscapeDisabled &&
												styles.orientationButtonDisabled,
											pressed &&
												!landscapeDisabled &&
												styles.pressed,
										]}
									>
										<Ionicons
											name="image-outline"
											size={22}
											color={
												orientation === "landscape"
													? colors.primaryPressed
													: landscapeDisabled
														? colors.disabledText
														: colors.text
											}
										/>

										<Text
											style={[
												styles.orientationButtonText,
												orientation === "landscape" &&
													styles.orientationButtonTextSelected,
												landscapeDisabled &&
													styles.orientationButtonTextDisabled,
											]}
										>
											Paisagem
										</Text>
									</Pressable>

									<Pressable
										onPress={() =>
											allowOrientationSelection &&
											setOrientation("portrait")
										}
										disabled={portraitDisabled}
										style={({ pressed }) => [
											styles.orientationButton,
											orientation === "portrait" &&
												styles.orientationButtonSelected,
											portraitDisabled &&
												styles.orientationButtonDisabled,
											pressed &&
												!portraitDisabled &&
												styles.pressed,
										]}
									>
										<Ionicons
											name="phone-portrait-outline"
											size={22}
											color={
												orientation === "portrait"
													? colors.primaryPressed
													: portraitDisabled
														? colors.disabledText
														: colors.text
											}
										/>

										<Text
											style={[
												styles.orientationButtonText,
												orientation === "portrait" &&
													styles.orientationButtonTextSelected,
												portraitDisabled &&
													styles.orientationButtonTextDisabled,
											]}
										>
											Retrato
										</Text>
									</Pressable>
								</View>
							</>
						) : (
							<View style={styles.placeholder}>
								<View style={styles.placeholderIconWrap}>
									<Feather
										name="image"
										size={44}
										color={colors.textMuted}
									/>

									<View style={styles.placeholderPlusBadge}>
										<Ionicons
											name="add"
											size={18}
											color={colors.white}
										/>
									</View>
								</View>

								<Text style={styles.placeholderTitle}>
									Nenhuma foto selecionada
								</Text>

								<Text style={styles.placeholderText}>
									Escolha uma foto da sua galeria
									{"\n"}para adicionar à coleção.
								</Text>
							</View>
						)}
					</View>

					<View style={styles.bottomArea}>
						{selectedImageUri ? (
							<PrimaryButton
								title="Continuar"
								onPress={continueToCrop}
								disabled={!isReadyToContinue}
								rightIcon={
									<Feather
										name="arrow-right"
										size={21}
										color={colors.white}
									/>
								}
							/>
						) : (
							<PrimaryButton
								title="Escolher foto"
								onPress={pickImage}
								loading={pickingImage}
								leftIcon={
									<Feather
										name="image"
										size={21}
										color={colors.white}
									/>
								}
							/>
						)}
					</View>
				</View>
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

	screenContent: {
		flex: 1,
	},

	body: {
		flex: 1,
	},

	content: {
		flex: 1,
		position: "relative",
		justifyContent: "flex-start",
	},

	pressed: {
		opacity: 0.72,
	},

	placeholder: {
		flex: 1,
		borderWidth: 1.5,
		borderStyle: "dashed",
		borderColor: colors.border,
		borderRadius: radius.xl,
		backgroundColor: colors.surface,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.xxl,
		paddingVertical: spacing.xxxl,
	},

	placeholderIconWrap: {
		position: "relative",
		alignItems: "center",
		justifyContent: "center",
	},

	placeholderPlusBadge: {
		position: "absolute",
		right: -10,
		bottom: -6,
		width: 28,
		height: 28,
		borderRadius: radius.pill,
		backgroundColor: "#2E7D4F",
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 2,
		borderColor: colors.surface,
	},

	placeholderTitle: {
		marginTop: spacing.xl,
		...typography.emptyTitle,
		color: colors.text,
		textAlign: "center",
	},

	placeholderText: {
		marginTop: spacing.md,
		...typography.body,
		color: colors.textSecondary,
		textAlign: "center",
	},

	image: {
		width: "100%",
		maxHeight: 550,
		borderRadius: radius.xl,
	},

	imageFrame: {
		width: "100%",

		padding: 8,

		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.xl,

		backgroundColor: colors.surfaceMuted,

		alignItems: "center",
	},

	removeButton: {
		position: "absolute",
		top: spacing.md,
		right: spacing.md,
		width: 40,
		height: 40,
		borderRadius: radius.pill,
		backgroundColor: "rgba(0, 0, 0, 0.35)",
		alignItems: "center",
		justifyContent: "center",
	},

	orientationRow: {
		marginTop: spacing.lg,
		flexDirection: "row",
		gap: spacing.md,
	},

	orientationButton: {
		flex: 1,
		minHeight: 58,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
		paddingHorizontal: spacing.md,
	},

	orientationButtonSelected: {
		borderColor: "#85C9A6",
		backgroundColor: colors.primarySoft,
	},

	orientationButtonDisabled: {
		backgroundColor: colors.disabled,
		borderColor: colors.borderSoft,
	},

	orientationButtonText: {
		...typography.body,
		fontWeight: "600",
		color: colors.text,
	},

	orientationButtonTextSelected: {
		color: colors.primaryPressed,
	},

	orientationButtonTextDisabled: {
		color: colors.disabledText,
	},

	bottomArea: {
		paddingTop: spacing.xl,
	},
});
