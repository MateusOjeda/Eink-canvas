import { useEffect, useState } from "react";

import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";

import { Paths } from "expo-file-system";

import { ImageManipulator } from "expo-image-manipulator";

import { Gesture, GestureDetector } from "react-native-gesture-handler";

import Animated, {
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";

import { Picker } from "@react-native-picker/picker";

import { getDisplaySize } from "@/constants/displays";

import type { DisplayOrientation, DisplayType } from "@/types/display";

import { convertToSpectra6 } from "@/image-processing/spectra6/index";

import type { Spectra6Algorithm } from "@/image-processing/spectra6/types";

import { getDevice } from "@/firebase/devices";

import { createThumbnail } from "@/image-processing/thumbnail";

function clamp(value: number, min: number, max: number) {
	"worklet";

	return Math.min(Math.max(value, min), max);
}

export default function CropPhotoScreen() {
	const params = useLocalSearchParams<{
		deviceId: string;

		collectionId?: string;

		mode?: "collection" | "temporary";

		fileName: string;
		imageWidth: string;
		imageHeight: string;

		orientation: DisplayOrientation;
	}>();

	const photoMode = params.mode ?? "collection";

	/*
	 * Reconstrói a URI da foto que copiamos
	 * anteriormente para o cache do aplicativo.
	 */
	const uri = Paths.join(Paths.cache, params.fileName);

	const orientation = params.orientation;

	const imageWidth = Number(params.imageWidth);

	const imageHeight = Number(params.imageHeight);

	const { width: screenWidth, height: screenHeight } = useWindowDimensions();

	/*
	 * O modelo do display agora vem
	 * do Device salvo no Firestore.
	 */
	const [displayType, setDisplayType] = useState<DisplayType | null>(null);

	const [deviceLoadError, setDeviceLoadError] = useState<string | null>(null);

	useEffect(() => {
		const loadDevice = async () => {
			try {
				setDeviceLoadError(null);

				const device = await getDevice(params.deviceId);

				if (!device) {
					throw new Error("Dispositivo não encontrado.");
				}

				setDisplayType(device.displayType);
			} catch (error) {
				console.error("Erro ao carregar dispositivo:", error);

				setDeviceLoadError(
					error instanceof Error
						? error.message
						: "Não foi possível carregar o dispositivo.",
				);
			}
		};

		loadDevice();
	}, [params.deviceId]);

	/*
	 * Enquanto o Device ainda está carregando,
	 * usamos um tamanho provisório apenas para
	 * manter todos os hooks sendo executados.
	 *
	 * Essa dimensão nunca é mostrada ao usuário.
	 */
	const displaySize = displayType
		? getDisplaySize(displayType, orientation)
		: {
				width: 1,
				height: 1,
			};

	const aspectRatio = displaySize.width / displaySize.height;

	/*
	 * Algoritmo padrão.
	 */
	const [algorithm, setAlgorithm] = useState<Spectra6Algorithm>(
		"floyd-steinberg-oklab-serpentine",
	);

	/*
	 * Loading durante:
	 *
	 * crop
	 * +
	 * resize
	 * +
	 * quantização
	 * +
	 * preview
	 * +
	 * .bin
	 */
	const [isProcessing, setIsProcessing] = useState(false);

	/*
	 * Tamanho visual da janela de crop.
	 *
	 * A resolução real continua sendo
	 * displaySize.width x displaySize.height.
	 */
	const availableWidth = screenWidth - 48;

	const maxCropHeight = screenHeight * 0.55;

	const cropWidth = Math.min(availableWidth, maxCropHeight * aspectRatio);

	const cropHeight = cropWidth / aspectRatio;

	/*
	 * Estado dos gestos.
	 */
	const translateX = useSharedValue(0);

	const translateY = useSharedValue(0);

	const savedTranslateX = useSharedValue(0);

	const savedTranslateY = useSharedValue(0);

	const scale = useSharedValue(1);

	const savedScale = useSharedValue(1);

	/*
	 * Escala mínima necessária para
	 * a imagem preencher completamente
	 * a janela de crop.
	 */
	const baseScale = Math.max(
		cropWidth / imageWidth,

		cropHeight / imageHeight,
	);

	const renderedWidth = imageWidth * baseScale;

	const renderedHeight = imageHeight * baseScale;

	/*
	 * Reseta o enquadramento caso
	 * dimensões relevantes mudem.
	 *
	 * Isso também acontece quando o Device
	 * termina de carregar e descobrimos
	 * a resolução real do display.
	 */
	useEffect(() => {
		translateX.value = 0;
		translateY.value = 0;

		savedTranslateX.value = 0;
		savedTranslateY.value = 0;

		scale.value = 1;
		savedScale.value = 1;
	}, [cropWidth, cropHeight, imageWidth, imageHeight]);

	/*
	 * Arrastar imagem.
	 */
	const panGesture = Gesture.Pan()
		.onBegin(() => {
			savedTranslateX.value = translateX.value;

			savedTranslateY.value = translateY.value;
		})
		.onUpdate((event) => {
			const currentWidth = renderedWidth * scale.value;

			const currentHeight = renderedHeight * scale.value;

			const maxX = Math.max(0, (currentWidth - cropWidth) / 2);

			const maxY = Math.max(0, (currentHeight - cropHeight) / 2);

			translateX.value = clamp(
				savedTranslateX.value + event.translationX,

				-maxX,
				maxX,
			);

			translateY.value = clamp(
				savedTranslateY.value + event.translationY,

				-maxY,
				maxY,
			);
		});

	/*
	 * Zoom com pinça.
	 */
	const pinchGesture = Gesture.Pinch()
		.onBegin(() => {
			savedScale.value = scale.value;
		})
		.onUpdate((event) => {
			const newScale = clamp(
				savedScale.value * event.scale,

				1,
				5,
			);

			scale.value = newScale;

			const currentWidth = renderedWidth * newScale;

			const currentHeight = renderedHeight * newScale;

			const maxX = Math.max(0, (currentWidth - cropWidth) / 2);

			const maxY = Math.max(0, (currentHeight - cropHeight) / 2);

			/*
			 * Se diminuirmos o zoom,
			 * também precisamos corrigir
			 * a posição para evitar
			 * espaço vazio.
			 */
			translateX.value = clamp(translateX.value, -maxX, maxX);

			translateY.value = clamp(translateY.value, -maxY, maxY);
		});

	/*
	 * Permite pan + pinch simultâneos.
	 */
	const gesture = Gesture.Simultaneous(panGesture, pinchGesture);

	/*
	 * Mantemos translate e scale
	 * em elementos diferentes.
	 *
	 * Isso evita distorções na matemática
	 * dos limites de arraste.
	 */
	const animatedPositionStyle = useAnimatedStyle(() => ({
		transform: [
			{
				translateX: translateX.value,
			},
			{
				translateY: translateY.value,
			},
		],
	}));

	const animatedScaleStyle = useAnimatedStyle(() => ({
		transform: [
			{
				scale: scale.value,
			},
		],
	}));

	/*
	 * Converte o enquadramento visual
	 * para coordenadas da imagem original,
	 * faz o crop e já redimensiona para
	 * a resolução final do display.
	 */
	const createCroppedImage = async () => {
		const currentScale = scale.value;

		const effectiveScale = baseScale * currentScale;

		const rawCropWidth = cropWidth / effectiveScale;

		const rawCropHeight = cropHeight / effectiveScale;

		const rawOriginX =
			((renderedWidth * currentScale - cropWidth) / 2 -
				translateX.value) /
			effectiveScale;

		const rawOriginY =
			((renderedHeight * currentScale - cropHeight) / 2 -
				translateY.value) /
			effectiveScale;

		/*
		 * Manipulador trabalha em pixels.
		 */
		const width = Math.min(imageWidth, Math.round(rawCropWidth));

		const height = Math.min(imageHeight, Math.round(rawCropHeight));

		/*
		 * Proteção contra arredondamento
		 * ultrapassar os limites da imagem.
		 */
		const originX = Math.max(
			0,

			Math.min(
				imageWidth - width,

				Math.round(rawOriginX),
			),
		);

		const originY = Math.max(
			0,

			Math.min(
				imageHeight - height,

				Math.round(rawOriginY),
			),
		);

		const context = ImageManipulator.manipulate(uri);

		context.crop({
			originX,
			originY,
			width,
			height,
		});

		context.resize({
			width: displaySize.width,

			height: displaySize.height,
		});

		const renderedImage = await context.renderAsync();

		return renderedImage.saveAsync();
	};

	/*
	 * Fluxo completo:
	 *
	 * crop
	 * ↓
	 * resize
	 * ↓
	 * algoritmo Spectra 6
	 * ↓
	 * PNG de preview
	 * ↓
	 * arquivo .bin
	 * ↓
	 * preview-photo OU temporary-photo
	 */
	const continueWithCrop = async () => {
		setIsProcessing(true);

		/*
		 * Pequeno atraso para permitir que
		 * React Native desenhe o loading
		 * antes do loop pesado começar.
		 */
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 50);
		});

		try {
			const croppedImage = await createCroppedImage();

			const spectraImage = await convertToSpectra6(
				croppedImage.uri,
				algorithm,
			);

			/*
			 * Foto temporária:
			 *
			 * não precisamos gerar thumbnail
			 * e não passamos pela tela
			 * preview-photo.
			 */
			if (photoMode === "temporary") {
				setIsProcessing(false);

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

			/*
			 * Foto normal de coleção.
			 */
			if (!params.collectionId) {
				throw new Error("Collection ID não informado.");
			}

			const thumbnail = await createThumbnail(
				croppedImage.uri,
				displaySize.width,
				displaySize.height,
			);

			setIsProcessing(false);

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
			setIsProcessing(false);

			console.error("Erro ao processar imagem:", error);
		}
	};

	/*
	 * IMPORTANTE:
	 *
	 * Os returns condicionais ficam somente
	 * depois que TODOS os hooks acima
	 * já foram executados.
	 */
	if (deviceLoadError) {
		return (
			<View style={styles.loadingContainer}>
				<Text style={styles.errorText}>{deviceLoadError}</Text>
			</View>
		);
	}

	if (!displayType) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" />

				<Text style={styles.loadingText}>Carregando quadro…</Text>
			</View>
		);
	}

	if (isProcessing) {
		return (
			<View style={styles.processingContainer}>
				<ActivityIndicator size="large" />

				<Text style={styles.processingTitle}>Processando imagem</Text>

				<Text style={styles.processingText}>
					Preparando a foto para o Spectra 6…
				</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text style={styles.resolution}>
				{displaySize.width} × {displaySize.height}
			</Text>

			<View style={styles.cropContainer}>
				<GestureDetector gesture={gesture}>
					<View
						style={[
							styles.cropArea,
							{
								width: cropWidth,

								height: cropHeight,
							},
						]}
					>
						<Animated.View style={animatedPositionStyle}>
							<Animated.Image
								source={{
									uri,
								}}
								style={[
									{
										width: renderedWidth,

										height: renderedHeight,
									},

									animatedScaleStyle,
								]}
							/>
						</Animated.View>
					</View>
				</GestureDetector>
			</View>

			<Text style={styles.hint}>
				Arraste para posicionar a foto. Use dois dedos para ampliar ou
				reduzir.
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
						dropdownIconColor="#111111"
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

						<Picker.Item label="Nearest RGB" value="nearest-rgb" />

						<Picker.Item
							label="Good Display — Floyd–Steinberg"
							value="good-display-floyd-steinberg"
						/>
					</Picker>
				</View>
			</View>

			<Pressable style={styles.continueButton} onPress={continueWithCrop}>
				<Text style={styles.continueButtonText}>Continuar</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,

		backgroundColor: "#ffffff",

		paddingHorizontal: 24,

		paddingVertical: 20,
	},

	resolution: {
		textAlign: "center",

		fontSize: 14,

		marginBottom: 12,

		color: "#555555",
	},

	cropContainer: {
		flex: 1,

		justifyContent: "center",

		alignItems: "center",
	},

	cropArea: {
		overflow: "hidden",

		backgroundColor: "#eeeeee",

		borderWidth: 2,

		borderColor: "#111111",

		justifyContent: "center",

		alignItems: "center",
	},

	hint: {
		textAlign: "center",

		color: "#666666",

		fontSize: 14,

		lineHeight: 20,

		marginTop: 16,
	},

	algorithmSection: {
		marginTop: 20,
	},

	algorithmLabel: {
		fontSize: 15,

		fontWeight: "600",

		marginBottom: 8,
	},

	pickerContainer: {
		borderWidth: 1,

		borderColor: "#cccccc",

		borderRadius: 12,

		overflow: "hidden",

		backgroundColor: "#ffffff",
	},

	continueButton: {
		backgroundColor: "#6b6b6b",

		borderRadius: 12,

		paddingVertical: 14,

		alignItems: "center",

		marginTop: 20,
	},

	continueButtonText: {
		color: "#ffffff",

		fontSize: 16,

		fontWeight: "600",
	},

	processingContainer: {
		flex: 1,

		backgroundColor: "#ffffff",

		alignItems: "center",

		justifyContent: "center",

		padding: 24,
	},

	processingTitle: {
		marginTop: 20,

		fontSize: 18,

		fontWeight: "600",
	},

	processingText: {
		marginTop: 8,

		fontSize: 14,

		color: "#666666",

		textAlign: "center",
	},

	loadingContainer: {
		flex: 1,

		backgroundColor: "#ffffff",

		alignItems: "center",

		justifyContent: "center",

		padding: 24,
	},

	loadingText: {
		marginTop: 12,

		fontSize: 14,

		color: "#666666",
	},

	errorText: {
		fontSize: 15,

		color: "#b00020",

		textAlign: "center",
	},

	picker: {
		color: "#111111",
	},
});
