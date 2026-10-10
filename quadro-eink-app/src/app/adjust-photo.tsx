import { useCallback, useEffect, useRef, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Image,
	StyleSheet,
	Text,
	View,
} from "react-native";

import Slider from "@react-native-community/slider";

import { router, Stack, useLocalSearchParams } from "expo-router";

import { File, Paths } from "expo-file-system";

import { Feather } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, spacing, typography } from "@/theme";

import type { DisplayOrientation } from "@/types/display";
import type { Spectra6Algorithm } from "@/image-processing/spectra6/types";

import { convertToSpectra6 } from "@/image-processing/spectra6";
import { createThumbnail } from "@/image-processing/thumbnail";

import { useDeviceProcessing } from "@/contexts/DeviceProcessingContext";

import {
	loadImageRgba,
	createAdjustedPreview,
	saveAdjustedImage,
} from "@/image-processing/spectra6/image";

import { Picker } from "@react-native-picker/picker";

export default function AdjustPhotoScreen() {
	const params = useLocalSearchParams<{
		deviceId: string;
		collectionId?: string;
		mode?: "collection" | "temporary";
		fileName: string;
		imageWidth: string;
		imageHeight: string;
		orientation: DisplayOrientation;
		deviceName?: string;
		collectionName?: string;
	}>();

	const photoMode = params.mode ?? "collection";

	const uri = Paths.join(Paths.cache, params.fileName);

	const subtitle =
		photoMode === "collection"
			? [params.collectionName, params.deviceName]
					.filter(Boolean)
					.join(" · ")
			: (params.deviceName ?? "");

	const [brightness, setBrightness] = useState(0);
	const [saturation, setSaturation] = useState(100);

	const [algorithm, setAlgorithm] = useState<Spectra6Algorithm>(
		"good-display-floyd-steinberg",
	);

	const [isProcessing, setIsProcessing] = useState(false);

	const [previewUri, setPreviewUri] = useState(uri);
	const [isUpdatingPreview, setIsUpdatingPreview] = useState(false);

	const deviceProcessing = useDeviceProcessing();

	const originalPixels = useRef<{
		pixels: Uint8Array;
		width: number;
		height: number;
	} | null>(null);

	const previewFileRef = useRef<File | null>(null);
	const previewRequestId = useRef(0);

	const updatePreview = useCallback(async () => {
		const requestId = ++previewRequestId.current;

		try {
			setIsUpdatingPreview(true);

			if (!originalPixels.current) {
				originalPixels.current = await loadImageRgba(uri);
			}

			if (requestId !== previewRequestId.current) return;

			const { pixels, width, height } = originalPixels.current;

			const jpegBytes = await createAdjustedPreview(
				pixels,
				width,
				height,
				brightness,
				saturation,
			);

			if (requestId !== previewRequestId.current) return;

			const previewFile = new File(
				Paths.cache,
				`adjusted-preview-${Date.now()}-${requestId}.jpg`,
			);

			await previewFile.write(jpegBytes);

			if (requestId !== previewRequestId.current) {
				previewFile.delete();
				return;
			}

			const previousFile = previewFileRef.current;

			previewFileRef.current = previewFile;
			setPreviewUri(previewFile.uri);

			if (previousFile) {
				previousFile.delete();
			}
		} catch (error) {
			console.error("Erro ao atualizar prévia:", error);
		} finally {
			if (requestId === previewRequestId.current) {
				setIsUpdatingPreview(false);
			}
		}
	}, [uri, brightness, saturation]);

	useEffect(() => {
		if (brightness === 0 && saturation === 100) {
			previewRequestId.current++;
			setPreviewUri(uri);
			setIsUpdatingPreview(false);

			previewFileRef.current?.delete();
			previewFileRef.current = null;

			return;
		}

		const timeout = setTimeout(() => {
			void updatePreview();
		}, 150);

		return () => clearTimeout(timeout);
	}, [uri, brightness, saturation, updatePreview]);

	useEffect(() => {
		return () => {
			previewRequestId.current++;
			previewFileRef.current?.delete();
			previewFileRef.current = null;
		};
	}, []);

	const continueWithAdjustments = async () => {
		setIsProcessing(true);

		try {
			const spectraImage = await convertToSpectra6(
				uri,
				algorithm,
				params.orientation,
				brightness,
				saturation,
			);

			if (photoMode === "temporary") {
				router.dismissTo({
					pathname: "/device/[deviceId]/temporary-photo",
					params: {
						deviceId: params.deviceId,
						previewFileName: Paths.basename(spectraImage.uri),
						binFileName: Paths.basename(spectraImage.binUri),
						imageWidth: spectraImage.width.toString(),
						imageHeight: spectraImage.height.toString(),
					},
				});

				return;
			}

			if (!params.collectionId) {
				throw new Error("Collection ID não informado.");
			}

			const adjustedUri = await saveAdjustedImage(
				uri,
				brightness,
				saturation,
			);

			const thumbnail = await createThumbnail(
				adjustedUri,
				Number(params.imageWidth),
				Number(params.imageHeight),
			);
			router.push({
				pathname: "/preview-photo",
				params: {
					deviceId: params.deviceId,
					collectionId: params.collectionId,
					fileName: Paths.basename(spectraImage.uri),
					thumbnailFileName: Paths.basename(thumbnail.uri),
					binFileName: Paths.basename(spectraImage.binUri),
					imageWidth: spectraImage.width.toString(),
					imageHeight: spectraImage.height.toString(),
				},
			});
		} catch (error) {
			console.error("Erro ao ajustar imagem:", error);

			Alert.alert(
				"Erro ao processar imagem",
				error instanceof Error
					? error.message
					: "Não foi possível processar a imagem.",
			);
		} finally {
			setIsProcessing(false);
		}
	};

	if (isProcessing) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />

				<Screen>
					<View style={styles.centerState}>
						<ActivityIndicator
							size="large"
							color={colors.primary}
						/>

						<Text style={styles.processingTitle}>
							Convertendo para Spectra 6
						</Text>

						<Text style={styles.secondaryText}>
							Aplicando os ajustes e preparando a imagem…
						</Text>
					</View>
				</Screen>
			</>
		);
	}

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<Screen contentContainerStyle={styles.screen}>
				<ScreenHeader
					title="Ajustar imagem"
					subtitle={subtitle}
					showBackButton
					style={styles.header}
					processing={deviceProcessing}
				/>

				<View style={styles.previewContainer}>
					<Image
						source={{ uri: previewUri }}
						style={styles.previewImage}
						resizeMode="contain"
					/>
					{isUpdatingPreview && (
						<View style={styles.previewLoading}>
							<ActivityIndicator
								size="small"
								color={colors.primary}
							/>
						</View>
					)}
				</View>

				<Text style={styles.hint}>
					Ajuste a imagem antes de convertê-la para as seis cores do
					quadro.
				</Text>

				<View style={styles.controlSection}>
					<View style={styles.labelRow}>
						<Text style={styles.controlLabel}>Brilho</Text>

						<Text style={styles.value}>
							{brightness > 0 ? "+" : ""}
							{brightness}
						</Text>
					</View>

					<Slider
						minimumValue={-50}
						maximumValue={50}
						step={1}
						value={brightness}
						onValueChange={(value) => {
							setBrightness(value);
							setIsUpdatingPreview(true);
						}}
						minimumTrackTintColor={colors.primary}
						maximumTrackTintColor={colors.border}
						thumbTintColor={colors.primary}
					/>

					<View style={styles.rangeLabels}>
						<Text style={styles.rangeText}>Mais escuro</Text>
						<Text style={styles.rangeText}>Mais claro</Text>
					</View>
				</View>

				<View style={styles.controlSection}>
					<View style={styles.labelRow}>
						<Text style={styles.controlLabel}>Saturação</Text>

						<Text style={styles.value}>{saturation}%</Text>
					</View>

					<Slider
						minimumValue={0}
						maximumValue={200}
						step={1}
						value={saturation}
						onValueChange={(value) => {
							setSaturation(value);
							setIsUpdatingPreview(true);
						}}
						minimumTrackTintColor={colors.primary}
						maximumTrackTintColor={colors.border}
						thumbTintColor={colors.primary}
					/>

					<View style={styles.rangeLabels}>
						<Text style={styles.rangeText}>Sem cor</Text>
						<Text style={styles.rangeText}>Mais intensa</Text>
					</View>
				</View>

				<View style={styles.controlSection}>
					<Text style={styles.controlLabel}>
						Algoritmo de conversão
					</Text>

					<View style={styles.algorithmSection}>
						<Text style={styles.algorithmLabel}>Algoritmo</Text>

						<View style={styles.pickerContainer}>
							<Picker
								selectedValue={algorithm}
								onValueChange={(value) => {
									setAlgorithm(value as Spectra6Algorithm);
								}}
								style={styles.picker}
								dropdownIconColor={colors.text}
							>
								<Picker.Item
									label="Floyd–Steinberg OKLab"
									value="floyd-steinberg-oklab-serpentine"
								/>

								<Picker.Item
									label="Floyd–Steinberg RGB"
									value="floyd-steinberg-rgb"
								/>

								<Picker.Item
									label="Barycentric + Blue Noise"
									value="barycentric-blue-noise"
								/>

								<Picker.Item
									label="Barycentric + Blue Noise (Compensated)"
									value="barycentric-blue-noise-compensated"
								/>

								<Picker.Item
									label="Nearest RGB"
									value="nearest-rgb"
								/>

								<Picker.Item
									label="Good Display — Floyd–Steinberg"
									value="good-display-floyd-steinberg"
								/>
							</Picker>
						</View>
					</View>
				</View>

				<PrimaryButton
					title="Converter e continuar"
					onPress={continueWithAdjustments}
					style={styles.continueButton}
					rightIcon={
						<Feather
							name="arrow-right"
							size={21}
							color={colors.white}
						/>
					}
				/>
			</Screen>
		</>
	);
}

const styles = StyleSheet.create({
	screen: {
		flexGrow: 1,
		paddingBottom: spacing.xl,
	},

	header: {
		marginBottom: spacing.md,
	},

	previewContainer: {
		width: "100%",
		height: 220,
		borderRadius: radius.lg,
		backgroundColor: colors.surfaceMuted,
		overflow: "hidden",
	},

	previewImage: {
		width: "100%",
		height: "100%",
	},

	hint: {
		marginTop: spacing.sm,
		...typography.body,
		color: colors.textSecondary,
	},

	controlSection: {
		marginTop: spacing.lg,
	},

	labelRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},

	controlLabel: {
		...typography.cardTitle,
		color: colors.text,
	},

	value: {
		...typography.body,
		color: colors.primary,
		fontWeight: "600",
	},

	rangeLabels: {
		flexDirection: "row",
		justifyContent: "space-between",
	},

	rangeText: {
		...typography.caption,
		color: colors.textSecondary,
	},

	algorithmList: {
		marginTop: spacing.sm,
		gap: spacing.xs,
	},

	algorithmButton: {
		marginTop: 0,
	},

	continueButton: {
		marginTop: spacing.xl,
	},

	centerState: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.xxl,
	},

	processingTitle: {
		marginTop: spacing.xl,
		...typography.emptyTitle,
		color: colors.text,
	},

	secondaryText: {
		marginTop: spacing.sm,
		...typography.body,
		color: colors.textSecondary,
		textAlign: "center",
	},

	algorithmSection: {
		gap: spacing.sm,
	},

	algorithmLabel: {
		...typography.caption,
		color: colors.text,
	},

	pickerContainer: {
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.md,
		overflow: "hidden",
	},

	picker: {
		color: colors.text,
	},

	previewLoading: {
		position: "absolute",
		top: spacing.sm,
		right: spacing.sm,
		backgroundColor: colors.surfaceMuted,
		borderRadius: radius.md,
		padding: spacing.xs,
	},
});
