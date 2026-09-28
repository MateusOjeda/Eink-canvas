import { useEffect, useMemo, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Image,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	useWindowDimensions,
	View,
} from "react-native";

import {
	router,
	Stack,
	useLocalSearchParams,
} from "expo-router";

import { Directory, File, Paths } from "expo-file-system";

import { Feather } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import {
	colors,
	radius,
	spacing,
	typography,
} from "@/theme";

import { savePhoto } from "@/firebase/photos";
import { getDevice } from "@/firebase/devices";
import { getPhotoCollection } from "@/firebase/collections";

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

	const [deviceName, setDeviceName] = useState("");
	const [collectionName, setCollectionName] =
		useState("");
	const [loadingContext, setLoadingContext] =
		useState(true);

	const imageWidth = Number(params.imageWidth);
	const imageHeight = Number(params.imageHeight);

	const { width: screenWidth } = useWindowDimensions();

	const previewAspectRatio =
		imageWidth / imageHeight;

	const previewMaxWidth = Math.min(
		screenWidth - spacing.xxl * 2,
		320,
	);

	const previewMaxHeight = 240;

	const previewSize = (() => {
		let width = previewMaxWidth;
		let height = width / previewAspectRatio;

		if (height > previewMaxHeight) {
			height = previewMaxHeight;
			width = height * previewAspectRatio;
		}

		return { width, height };
	})();

	const previewUri = Paths.join(
		Paths.cache,
		params.fileName,
	);

	const thumbnailUri = Paths.join(
		Paths.cache,
		params.thumbnailFileName,
	);

	const binUri = Paths.join(
		Paths.cache,
		params.binFileName,
	);

	useEffect(() => {
		let isMounted = true;

		const loadContext = async () => {
			try {
				const [device, collection] =
					await Promise.all([
						getDevice(params.deviceId),
						getPhotoCollection(
							params.deviceId,
							params.collectionId,
						),
					]);

				if (!isMounted) {
					return;
				}

				if (device) {
					setDeviceName(device.name);
				}

				if (collection) {
					setCollectionName(
						collection.name,
					);
				}
			} catch (error) {
				console.error(
					"Erro ao carregar contexto da prévia:",
					error,
				);
			} finally {
				if (isMounted) {
					setLoadingContext(false);
				}
			}
		};

		loadContext();

		return () => {
			isMounted = false;
		};
	}, [params.deviceId, params.collectionId]);

	const subtitle = useMemo(
		() =>
			[collectionName, deviceName]
				.filter(Boolean)
				.join(" · "),
		[collectionName, deviceName],
	);

	const downloadBin = async () => {
		try {
			const sourceFile = new File(binUri);

			if (!sourceFile.exists) {
				throw new Error(
					"Arquivo .bin não encontrado.",
				);
			}

			const destinationDirectory =
				await Directory.pickDirectoryAsync();

			const outputName =
				`quadro-eink-${imageWidth}x${imageHeight}-${Date.now()}.bin`;

			const outputFile =
				destinationDirectory.createFile(
					outputName,
					"application/octet-stream",
				);

			const bytes = await sourceFile.bytes();

			await outputFile.write(bytes);

			Alert.alert(
				"Arquivo salvo",
				`${outputName}\n\n${bytes.length.toLocaleString()} bytes`,
			);
		} catch (error) {
			console.log(
				"Download do .bin cancelado ou falhou:",
				error,
			);
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

				width: imageWidth,
				height: imageHeight,

				description,
			});

			router.dismissTo({
				pathname:
					"/device/[deviceId]/collection/[collectionId]",
				params: {
					deviceId:
						params.deviceId,
					collectionId:
						params.collectionId,
				},
			});
		} catch (error) {
			console.error(
				"Erro ao salvar imagem:",
				error,
			);

			Alert.alert(
				"Erro",
				"Não foi possível salvar a imagem.",
			);
		} finally {
			setSaving(false);
		}
	};

	if (loadingContext) {
		return (
			<>
				<Stack.Screen
					options={{ headerShown: false }}
				/>

				<Screen>
					<View style={styles.loading}>
						<ActivityIndicator
							size="large"
							color={colors.primary}
						/>
					</View>
				</Screen>
			</>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{ headerShown: false }}
			/>

			<KeyboardAvoidingView
				style={styles.keyboardView}
				behavior={
					Platform.OS === "ios"
						? "padding"
						: "height"
				}
			>
				<Screen
					scroll
					contentContainerStyle={
						styles.screenContent
					}
					keyboardShouldPersistTaps="handled"
				>
					<ScreenHeader
						title="Prévia Spectra 6"
						subtitle={subtitle}
						showBackButton
						style={styles.header}
					/>

					<Text style={styles.resolution}>
						{imageWidth} × {imageHeight}
					</Text>

					<View style={styles.previewContainer}>
						<Image
							source={{ uri: previewUri }}
							style={[
								styles.image,
								{
									width:
										previewSize.width,
									height:
										previewSize.height,
								},
							]}
							resizeMode="contain"
						/>
					</View>

					<Text style={styles.hint}>
						Esta é a imagem já convertida
						para as cores da tela.
					</Text>

					<Pressable
						onPress={downloadBin}
						style={({ pressed }) => [
							styles.downloadButton,
							pressed &&
								styles.pressed,
						]}
					>
						<Feather
							name="download"
							size={22}
							color={colors.text}
						/>

						<Text
							style={
								styles.downloadButtonText
							}
						>
							Baixar .bin
						</Text>
					</Pressable>

					<View
						style={
							styles.descriptionSection
						}
					>
						<Text
							style={
								styles.descriptionLabel
							}
						>
							Descrição
						</Text>

						<TextInput
							value={description}
							onChangeText={setDescription}
							multiline
							maxLength={
								MAX_PHOTO_DESCRIPTION_LENGTH
							}
							textAlignVertical="top"
							placeholder="Quem está na foto? O que aconteceu? O que você quer lembrar?"
							placeholderTextColor={
								colors.textMuted
							}
							style={
								styles.descriptionInput
							}
						/>

						<Text
							style={
								styles.descriptionCounter
							}
						>
							{description.length} /{" "}
							{
								MAX_PHOTO_DESCRIPTION_LENGTH
							}
						</Text>
					</View>

					<PrimaryButton
						title={
							saving
								? "Salvando..."
								: "Usar imagem"
						}
						onPress={useImage}
						loading={saving}
						style={styles.useButton}
						rightIcon={
							<Feather
								name="arrow-right"
								size={21}
								color={colors.white}
							/>
						}
					/>
				</Screen>
			</KeyboardAvoidingView>
		</>
	);
}

const styles = StyleSheet.create({
	keyboardView: {
		flex: 1,
		backgroundColor: colors.background,
	},

	screenContent: {
		flexGrow: 1,
	},

	loading: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},

	header: {
		marginBottom: spacing.md,
	},

	pressed: {
		opacity: 0.72,
	},

	resolution: {
		marginBottom: spacing.sm,
		...typography.body,
		color: colors.textSecondary,
	},

	previewContainer: {
		alignItems: "center",
		justifyContent: "center",
	},

	image: {
		borderRadius: radius.lg,
		backgroundColor: colors.surfaceMuted,
	},

	hint: {
		marginTop: spacing.sm,
		...typography.body,
		color: colors.textSecondary,
	},

	downloadButton: {
		marginTop: spacing.lg,
		minHeight: 52,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.md,
		paddingHorizontal: spacing.lg,
	},

	downloadButtonText: {
		...typography.button,
		color: colors.text,
	},

	descriptionSection: {
		marginTop: spacing.lg,
	},

	descriptionLabel: {
		marginBottom: spacing.sm,
		...typography.cardTitle,
		color: colors.text,
	},

	descriptionInput: {
		minHeight: 88,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		...typography.input,
		color: colors.text,
	},

	descriptionCounter: {
		marginTop: spacing.xs,
		...typography.metadata,
		color: colors.textSecondary,
		textAlign: "right",
	},

	useButton: {
		marginTop: spacing.lg,
	},
});
