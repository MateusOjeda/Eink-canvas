import { useEffect, useMemo, useState } from "react";

import {
	ActivityIndicator,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";

import { router, Stack, useLocalSearchParams } from "expo-router";

import { File, Paths } from "expo-file-system";

import { ImageManipulator } from "expo-image-manipulator";

import { Gesture, GestureDetector } from "react-native-gesture-handler";

import Animated, {
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";

import { Feather } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, spacing, typography } from "@/theme";

import { getDisplaySize } from "@/constants/displays";

import type { DisplayOrientation, DisplayType } from "@/types/display";

import { getDevice } from "@/firebase/devices";
import { getPhotoCollection } from "@/firebase/collections";

import { useDeviceProcessing } from "@/contexts/DeviceProcessingContext";

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

	const uri = Paths.join(Paths.cache, params.fileName);

	const orientation = params.orientation;

	const imageWidth = Number(params.imageWidth);
	const imageHeight = Number(params.imageHeight);

	const { width: screenWidth, height: screenHeight } = useWindowDimensions();

	const [displayType, setDisplayType] = useState<DisplayType | null>(null);

	const [deviceName, setDeviceName] = useState("");
	const [collectionName, setCollectionName] = useState("");

	const [deviceLoadError, setDeviceLoadError] = useState<string | null>(null);

	const deviceProcessing = useDeviceProcessing();

	useEffect(() => {
		let isMounted = true;

		const loadContext = async () => {
			try {
				setDeviceLoadError(null);

				const [device, collection] = await Promise.all([
					getDevice(params.deviceId),
					params.collectionId
						? getPhotoCollection(
								params.deviceId,
								params.collectionId,
							)
						: Promise.resolve(null),
				]);

				if (!isMounted) {
					return;
				}

				if (!device) {
					throw new Error("Dispositivo não encontrado.");
				}

				setDisplayType(device.displayType);
				setDeviceName(device.name);

				if (collection) {
					setCollectionName(collection.name);
				}
			} catch (error) {
				console.error("Erro ao carregar contexto da foto:", error);

				if (!isMounted) {
					return;
				}

				setDeviceLoadError(
					error instanceof Error
						? error.message
						: "Não foi possível carregar o dispositivo.",
				);
			}
		};

		loadContext();

		return () => {
			isMounted = false;
		};
	}, [params.deviceId, params.collectionId]);

	const subtitle = useMemo(() => {
		if (photoMode === "collection") {
			return [collectionName, deviceName].filter(Boolean).join(" · ");
		}

		return deviceName;
	}, [collectionName, deviceName, photoMode]);

	/*
	 * Enquanto o Device ainda está carregando,
	 * usamos um tamanho provisório apenas para
	 * manter todos os hooks sendo executados.
	 */
	const displaySize = displayType
		? getDisplaySize(displayType, orientation)
		: {
				width: 1,
				height: 1,
			};

	const aspectRatio = displaySize.width / displaySize.height;

	const [isProcessing, setIsProcessing] = useState(false);

	/*
	 * A foto inteira fica visível.
	 * A moldura de crop é que se move e redimensiona
	 * sobre a imagem, sempre preservando o ratio do display.
	 */
	const availableImageWidth = screenWidth - spacing.xxl * 2;

	const maxImageHeight = Math.min(
		screenHeight * 0.56,
		Math.max(320, screenHeight - 340),
	);

	const imageAspectRatio = imageWidth / imageHeight;

	const renderedImageWidth = Math.min(
		availableImageWidth,
		maxImageHeight * imageAspectRatio,
	);

	const renderedImageHeight = renderedImageWidth / imageAspectRatio;

	const maxCropWidth = Math.min(
		renderedImageWidth,
		renderedImageHeight * aspectRatio,
	);

	const maxCropHeight = maxCropWidth / aspectRatio;

	const minCropWidth = Math.min(
		maxCropWidth,
		Math.max(80, maxCropWidth * 0.28),
	);

	const cropX = useSharedValue(0);
	const cropY = useSharedValue(0);
	const cropWidth = useSharedValue(1);
	const cropHeight = useSharedValue(1);

	const savedCropX = useSharedValue(0);
	const savedCropY = useSharedValue(0);
	const savedCropWidth = useSharedValue(1);
	const savedCropHeight = useSharedValue(1);

	useEffect(() => {
		const initialWidth = maxCropWidth * 0.86;
		const initialHeight = initialWidth / aspectRatio;

		cropWidth.value = initialWidth;
		cropHeight.value = initialHeight;

		cropX.value = (renderedImageWidth - initialWidth) / 2;

		cropY.value = (renderedImageHeight - initialHeight) / 2;
	}, [
		renderedImageWidth,
		renderedImageHeight,
		maxCropWidth,
		maxCropHeight,
		aspectRatio,
	]);

	const saveCropRect = () => {
		"worklet";

		savedCropX.value = cropX.value;
		savedCropY.value = cropY.value;
		savedCropWidth.value = cropWidth.value;
		savedCropHeight.value = cropHeight.value;
	};

	const getResizeDelta = (deltaX: number, deltaYAsWidth: number) => {
		"worklet";

		return Math.abs(deltaX) >= Math.abs(deltaYAsWidth)
			? deltaX
			: deltaYAsWidth;
	};

	const moveGesture = Gesture.Pan()
		.onBegin(() => {
			saveCropRect();
		})
		.onUpdate((event) => {
			cropX.value = clamp(
				savedCropX.value + event.translationX,
				0,
				renderedImageWidth - cropWidth.value,
			);

			cropY.value = clamp(
				savedCropY.value + event.translationY,
				0,
				renderedImageHeight - cropHeight.value,
			);
		});

	const resizeBottomRightGesture = Gesture.Pan()
		.onBegin(() => {
			saveCropRect();
		})
		.onUpdate((event) => {
			const delta = getResizeDelta(
				event.translationX,
				event.translationY * aspectRatio,
			);

			const maximumWidth = Math.min(
				renderedImageWidth - savedCropX.value,
				(renderedImageHeight - savedCropY.value) * aspectRatio,
			);

			const nextWidth = clamp(
				savedCropWidth.value + delta,
				minCropWidth,
				maximumWidth,
			);

			cropWidth.value = nextWidth;
			cropHeight.value = nextWidth / aspectRatio;
		});

	const resizeTopLeftGesture = Gesture.Pan()
		.onBegin(() => {
			saveCropRect();
		})
		.onUpdate((event) => {
			const delta = getResizeDelta(
				-event.translationX,
				-event.translationY * aspectRatio,
			);

			const right = savedCropX.value + savedCropWidth.value;

			const bottom = savedCropY.value + savedCropHeight.value;

			const maximumWidth = Math.min(right, bottom * aspectRatio);

			const nextWidth = clamp(
				savedCropWidth.value + delta,
				minCropWidth,
				maximumWidth,
			);

			const nextHeight = nextWidth / aspectRatio;

			cropWidth.value = nextWidth;
			cropHeight.value = nextHeight;

			cropX.value = right - nextWidth;

			cropY.value = bottom - nextHeight;
		});

	const resizeTopRightGesture = Gesture.Pan()
		.onBegin(() => {
			saveCropRect();
		})
		.onUpdate((event) => {
			const delta = getResizeDelta(
				event.translationX,
				-event.translationY * aspectRatio,
			);

			const left = savedCropX.value;

			const bottom = savedCropY.value + savedCropHeight.value;

			const maximumWidth = Math.min(
				renderedImageWidth - left,
				bottom * aspectRatio,
			);

			const nextWidth = clamp(
				savedCropWidth.value + delta,
				minCropWidth,
				maximumWidth,
			);

			const nextHeight = nextWidth / aspectRatio;

			cropWidth.value = nextWidth;
			cropHeight.value = nextHeight;

			cropX.value = left;

			cropY.value = bottom - nextHeight;
		});

	const resizeBottomLeftGesture = Gesture.Pan()
		.onBegin(() => {
			saveCropRect();
		})
		.onUpdate((event) => {
			const delta = getResizeDelta(
				-event.translationX,
				event.translationY * aspectRatio,
			);

			const right = savedCropX.value + savedCropWidth.value;

			const top = savedCropY.value;

			const maximumWidth = Math.min(
				right,
				(renderedImageHeight - top) * aspectRatio,
			);

			const nextWidth = clamp(
				savedCropWidth.value + delta,
				minCropWidth,
				maximumWidth,
			);

			cropWidth.value = nextWidth;
			cropHeight.value = nextWidth / aspectRatio;

			cropX.value = right - nextWidth;

			cropY.value = top;
		});

	const cropRectStyle = useAnimatedStyle(() => ({
		left: cropX.value,
		top: cropY.value,
		width: cropWidth.value,
		height: cropHeight.value,
	}));

	const topShadeStyle = useAnimatedStyle(() => ({
		height: cropY.value,
	}));

	const bottomShadeStyle = useAnimatedStyle(() => ({
		top: cropY.value + cropHeight.value,
		height: renderedImageHeight - cropY.value - cropHeight.value,
	}));

	const leftShadeStyle = useAnimatedStyle(() => ({
		top: cropY.value,
		width: cropX.value,
		height: cropHeight.value,
	}));

	const rightShadeStyle = useAnimatedStyle(() => ({
		left: cropX.value + cropWidth.value,
		top: cropY.value,
		width: renderedImageWidth - cropX.value - cropWidth.value,
		height: cropHeight.value,
	}));

	const handleTopLeftStyle = useAnimatedStyle(() => ({
		left: cropX.value - 22,
		top: cropY.value - 22,
	}));

	const handleTopRightStyle = useAnimatedStyle(() => ({
		left: cropX.value + cropWidth.value - 22,
		top: cropY.value - 22,
	}));

	const handleBottomLeftStyle = useAnimatedStyle(() => ({
		left: cropX.value - 22,
		top: cropY.value + cropHeight.value - 22,
	}));

	const handleBottomRightStyle = useAnimatedStyle(() => ({
		left: cropX.value + cropWidth.value - 22,
		top: cropY.value + cropHeight.value - 22,
	}));

	const createCroppedImage = async () => {
		const scaleX = imageWidth / renderedImageWidth;

		const scaleY = imageHeight / renderedImageHeight;

		const originX = Math.max(
			0,
			Math.min(imageWidth - 1, Math.round(cropX.value * scaleX)),
		);

		const originY = Math.max(
			0,
			Math.min(imageHeight - 1, Math.round(cropY.value * scaleY)),
		);

		const width = Math.min(
			imageWidth - originX,
			Math.round(cropWidth.value * scaleX),
		);

		const height = Math.min(
			imageHeight - originY,
			Math.round(cropHeight.value * scaleY),
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

	const continueWithCrop = async () => {
		setIsProcessing(true);

		await new Promise<void>((resolve) => {
			setTimeout(resolve, 50);
		});

		try {
			const croppedImage = await createCroppedImage();

			const fileName = Paths.basename(croppedImage.uri);
			const sourceFile = new File(croppedImage.uri);
			const destinationFile = new File(Paths.cache, fileName);

			if (sourceFile.uri !== destinationFile.uri) {
				sourceFile.copy(destinationFile);
			}

			setIsProcessing(false);

			router.push({
				pathname: "/adjust-photo",
				params: {
					deviceId: params.deviceId,
					collectionId: params.collectionId ?? "",
					mode: photoMode,
					fileName,
					imageWidth: displaySize.width.toString(),
					imageHeight: displaySize.height.toString(),
					orientation,
					deviceName,
					collectionName,
				},
			});
		} catch (error) {
			setIsProcessing(false);

			console.error("Erro ao recortar imagem:", error);
		}
	};

	if (deviceLoadError) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />

				<Screen>
					<View style={styles.centerState}>
						<Text style={styles.errorText}>{deviceLoadError}</Text>
					</View>
				</Screen>
			</>
		);
	}

	if (!displayType) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />

				<Screen>
					<View style={styles.centerState}>
						<ActivityIndicator
							size="large"
							color={colors.primary}
						/>

						<Text style={styles.loadingText}>
							Carregando quadro…
						</Text>
					</View>
				</Screen>
			</>
		);
	}

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
							Preparando recorte
						</Text>

						<Text style={styles.processingText}>
							Salvando a área selecionada…
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
					title="Ajustar foto"
					subtitle={subtitle}
					showBackButton
					style={styles.header}
					processing={deviceProcessing}
				/>

				<Text style={styles.resolution}>
					{displaySize.width} × {displaySize.height}
				</Text>

				<View style={styles.cropContainer}>
					<View
						style={[
							styles.imageStage,
							{
								width: renderedImageWidth,
								height: renderedImageHeight,
							},
						]}
					>
						<Animated.Image
							source={{ uri }}
							style={{
								width: renderedImageWidth,
								height: renderedImageHeight,
							}}
							resizeMode="contain"
						/>

						<Animated.View
							pointerEvents="none"
							style={[styles.shadeTop, topShadeStyle]}
						/>

						<Animated.View
							pointerEvents="none"
							style={[styles.shadeBottom, bottomShadeStyle]}
						/>

						<Animated.View
							pointerEvents="none"
							style={[styles.shadeLeft, leftShadeStyle]}
						/>

						<Animated.View
							pointerEvents="none"
							style={[styles.shadeRight, rightShadeStyle]}
						/>

						<GestureDetector gesture={moveGesture}>
							<Animated.View
								style={[styles.cropFrame, cropRectStyle]}
							>
								<View
									pointerEvents="none"
									style={[
										styles.verticalGridLine,
										{
											left: "33.333%",
										},
									]}
								/>

								<View
									pointerEvents="none"
									style={[
										styles.verticalGridLine,
										{
											left: "66.666%",
										},
									]}
								/>

								<View
									pointerEvents="none"
									style={[
										styles.horizontalGridLine,
										{
											top: "33.333%",
										},
									]}
								/>

								<View
									pointerEvents="none"
									style={[
										styles.horizontalGridLine,
										{
											top: "66.666%",
										},
									]}
								/>
							</Animated.View>
						</GestureDetector>

						<GestureDetector gesture={resizeTopLeftGesture}>
							<Animated.View
								style={[styles.handleTouch, handleTopLeftStyle]}
							>
								<View
									style={[
										styles.handleCorner,
										styles.handleTopLeft,
									]}
								/>
							</Animated.View>
						</GestureDetector>

						<GestureDetector gesture={resizeTopRightGesture}>
							<Animated.View
								style={[
									styles.handleTouch,
									handleTopRightStyle,
								]}
							>
								<View
									style={[
										styles.handleCorner,
										styles.handleTopRight,
									]}
								/>
							</Animated.View>
						</GestureDetector>

						<GestureDetector gesture={resizeBottomLeftGesture}>
							<Animated.View
								style={[
									styles.handleTouch,
									handleBottomLeftStyle,
								]}
							>
								<View
									style={[
										styles.handleCorner,
										styles.handleBottomLeft,
									]}
								/>
							</Animated.View>
						</GestureDetector>

						<GestureDetector gesture={resizeBottomRightGesture}>
							<Animated.View
								style={[
									styles.handleTouch,
									handleBottomRightStyle,
								]}
							>
								<View
									style={[
										styles.handleCorner,
										styles.handleBottomRight,
									]}
								/>
							</Animated.View>
						</GestureDetector>
					</View>
				</View>
				<Text style={styles.hint}>
					Arraste a moldura para posicionar. Use os cantos para
					aumentar ou reduzir o recorte.
				</Text>

				<PrimaryButton
					title="Continuar"
					onPress={continueWithCrop}
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
		flex: 1,
	},

	header: {
		marginBottom: spacing.sm,
	},

	centerState: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.xxl,
	},

	loadingText: {
		marginTop: spacing.md,
		...typography.body,
		color: colors.textSecondary,
	},

	errorText: {
		...typography.body,
		color: colors.danger,
		textAlign: "center",
	},

	processingTitle: {
		marginTop: spacing.xl,
		...typography.emptyTitle,
		color: colors.text,
	},

	processingText: {
		marginTop: spacing.sm,
		...typography.body,
		color: colors.textSecondary,
		textAlign: "center",
	},

	resolution: {
		marginBottom: spacing.xs,
		...typography.body,
		color: colors.textSecondary,
	},

	cropContainer: {
		alignItems: "center",
		justifyContent: "center",
	},

	imageStage: {
		position: "relative",
		overflow: "hidden",
		borderRadius: radius.lg,
		backgroundColor: colors.surfaceMuted,
	},

	shadeTop: {
		position: "absolute",
		left: 0,
		right: 0,
		top: 0,
		backgroundColor: "rgba(0, 0, 0, 0.42)",
	},

	shadeBottom: {
		position: "absolute",
		left: 0,
		right: 0,
		backgroundColor: "rgba(0, 0, 0, 0.42)",
	},

	shadeLeft: {
		position: "absolute",
		left: 0,
		backgroundColor: "rgba(0, 0, 0, 0.42)",
	},

	shadeRight: {
		position: "absolute",
		backgroundColor: "rgba(0, 0, 0, 0.42)",
	},

	cropFrame: {
		position: "absolute",
		borderWidth: 1.5,
		borderColor: "rgba(255, 255, 255, 0.95)",
		zIndex: 3,
	},

	verticalGridLine: {
		position: "absolute",
		top: 0,
		bottom: 0,
		width: StyleSheet.hairlineWidth,
		backgroundColor: "rgba(255, 255, 255, 0.55)",
	},

	horizontalGridLine: {
		position: "absolute",
		left: 0,
		right: 0,
		height: StyleSheet.hairlineWidth,
		backgroundColor: "rgba(255, 255, 255, 0.55)",
	},

	handleTouch: {
		position: "absolute",
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 5,
	},

	handleCorner: {
		width: 20,
		height: 20,
		borderColor: colors.white,
	},

	handleTopLeft: {
		borderTopWidth: 4,
		borderLeftWidth: 4,
	},

	handleTopRight: {
		borderTopWidth: 4,
		borderRightWidth: 4,
	},

	handleBottomLeft: {
		borderBottomWidth: 4,
		borderLeftWidth: 4,
	},

	handleBottomRight: {
		borderBottomWidth: 4,
		borderRightWidth: 4,
	},
	hint: {
		marginTop: spacing.sm,
		...typography.body,
		color: colors.textSecondary,
	},

	algorithmSection: {
		marginTop: spacing.md,
	},

	algorithmLabel: {
		marginBottom: spacing.sm,
		...typography.cardTitle,
		color: colors.text,
	},

	pickerContainer: {
		minHeight: 52,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		overflow: "hidden",
		backgroundColor: colors.surface,
		justifyContent: "center",
	},

	picker: {
		color: colors.text,
	},

	continueButton: {
		marginTop: spacing.md,
	},
});
