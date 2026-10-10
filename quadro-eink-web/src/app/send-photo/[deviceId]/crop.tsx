import { useEffect, useMemo, useRef, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Image,
	PanResponder,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";

import { router } from "expo-router";

import { Feather } from "@expo/vector-icons";

import { getDisplaySize } from "../../../constants/displays";

import { convertToSpectra6GoodDisplayWeb } from "../../../image-processing/spectra6/good-display-web";

import { useSendPhotoFlow } from "../../../contexts/SendPhotoFlowContext";

import {
	getDisplayName,
	getOrientationName,
} from "../../../utils/web-photo-flow";

type CropRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

type ResizeHandle = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const stylesConstants = {
	handleHitSize: 72,
	handleDotSize: 22,
} as const;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export default function CropPhotoScreen() {
	const { width: screenWidth } = useWindowDimensions();

	const compact = screenWidth < 420;

	const {
		device,
		deviceLoading,
		selectedImage,
		pickImage,
		setProcessedPhoto,
	} = useSendPhotoFlow();

	const [isProcessing, setIsProcessing] = useState(false);

	const [cropRect, setCropRect] = useState<CropRect>({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	});

	const cropStartRef = useRef<CropRect>(cropRect);

	const cropRectRef = useRef<CropRect>(cropRect);

	const previewSizeRef = useRef({
		width: 0,
		height: 0,
	});

	const cropAspectRatioRef = useRef(1);

	const [previewAreaSize, setPreviewAreaSize] = useState({
		width: 0,
		height: 0,
	});

	const webGestureStyle =
		Platform.OS === "web" ? ({ touchAction: "none" } as any) : undefined;

	useEffect(() => {
		cropRectRef.current = cropRect;
	}, [cropRect]);

	useEffect(() => {
		if (!deviceLoading && device && !selectedImage) {
			router.replace({
				pathname: "/send-photo/[deviceId]",
				params: {
					deviceId: device.id,
				},
			});
		}
	}, [deviceLoading, device, selectedImage]);

	const displaySize = useMemo(() => {
		if (!device) {
			return null;
		}

		return getDisplaySize(device.displayType, device.orientation);
	}, [device]);

	const cropAspectRatio = useMemo(() => {
		if (!displaySize) {
			return 1;
		}

		return displaySize.width / displaySize.height;
	}, [displaySize]);

	const previewSize = useMemo(() => {
		if (
			!selectedImage ||
			previewAreaSize.width <= 0 ||
			previewAreaSize.height <= 0
		) {
			return {
				width: 0,
				height: 0,
			};
		}

		const imageRatio = selectedImage.width / selectedImage.height;

		const maxWidth = Math.min(previewAreaSize.width, 620);

		const maxHeight = previewAreaSize.height;

		let width = maxWidth;
		let height = width / imageRatio;

		if (height > maxHeight) {
			height = maxHeight;
			width = height * imageRatio;
		}

		return {
			width,
			height,
		};
	}, [selectedImage, previewAreaSize.width, previewAreaSize.height]);
	useEffect(() => {
		previewSizeRef.current = previewSize;
	}, [previewSize]);

	useEffect(() => {
		cropAspectRatioRef.current = cropAspectRatio;
	}, [cropAspectRatio]);

	const updateCropRect = (next: CropRect) => {
		cropRectRef.current = next;
		setCropRect(next);
	};

	const createInitialCrop = () => {
		if (previewSize.width <= 0 || previewSize.height <= 0) {
			return;
		}

		const maxWidth = previewSize.width * 0.82;

		const maxHeight = previewSize.height * 0.82;

		let width = Math.min(maxWidth, maxHeight * cropAspectRatio);

		let height = width / cropAspectRatio;

		if (height > maxHeight) {
			height = maxHeight;
			width = height * cropAspectRatio;
		}

		updateCropRect({
			x: (previewSize.width - width) / 2,
			y: (previewSize.height - height) / 2,
			width,
			height,
		});
	};

	useEffect(() => {
		createInitialCrop();
	}, [
		previewSize.width,
		previewSize.height,
		cropAspectRatio,
		selectedImage?.uri,
	]);

	const moveResponder = useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: () => false,

				onMoveShouldSetPanResponder: (_, gesture) =>
					Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,

				onPanResponderGrant: () => {
					cropStartRef.current = {
						...cropRectRef.current,
					};
				},

				onPanResponderMove: (_, gesture) => {
					const start = cropStartRef.current;

					const preview = previewSizeRef.current;

					const next = {
						...start,
						x: clamp(
							start.x + gesture.dx,
							0,
							preview.width - start.width,
						),
						y: clamp(
							start.y + gesture.dy,
							0,
							preview.height - start.height,
						),
					};

					cropRectRef.current = next;

					setCropRect(next);
				},

				onPanResponderRelease: () => {},

				onPanResponderTerminate: () => {},

				onPanResponderTerminationRequest: () => false,
			}),
		[],
	);
	const createResizeResponder = (handle: ResizeHandle) =>
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,

			onStartShouldSetPanResponderCapture: () => true,

			onMoveShouldSetPanResponder: () => true,

			onMoveShouldSetPanResponderCapture: () => true,

			onPanResponderGrant: () => {
				cropStartRef.current = {
					...cropRectRef.current,
				};
			},

			onPanResponderMove: (_, gesture) => {
				const start = cropStartRef.current;

				const preview = previewSizeRef.current;

				const ratio = cropAspectRatioRef.current;

				const isLeft =
					handle === "top-left" || handle === "bottom-left";

				const isTop = handle === "top-left" || handle === "top-right";

				const horizontalDelta = (isLeft ? -1 : 1) * gesture.dx;

				const verticalDeltaAsWidth =
					(isTop ? -1 : 1) * gesture.dy * ratio;

				const proposedWidth =
					Math.abs(horizontalDelta) >= Math.abs(verticalDeltaAsWidth)
						? start.width + horizontalDelta
						: start.width + verticalDeltaAsWidth;

				const anchorRight = start.x + start.width;

				const anchorBottom = start.y + start.height;

				let maxWidth = 0;

				if (handle === "bottom-right") {
					maxWidth = Math.min(
						preview.width - start.x,
						(preview.height - start.y) * ratio,
					);
				}

				if (handle === "bottom-left") {
					maxWidth = Math.min(
						anchorRight,
						(preview.height - start.y) * ratio,
					);
				}

				if (handle === "top-right") {
					maxWidth = Math.min(
						preview.width - start.x,
						anchorBottom * ratio,
					);
				}

				if (handle === "top-left") {
					maxWidth = Math.min(anchorRight, anchorBottom * ratio);
				}

				if (maxWidth <= 0) {
					return;
				}

				const minWidth = Math.min(90, maxWidth);

				const width = clamp(proposedWidth, minWidth, maxWidth);

				const height = width / ratio;

				let x = start.x;
				let y = start.y;

				if (isLeft) {
					x = anchorRight - width;
				}

				if (isTop) {
					y = anchorBottom - height;
				}

				const next = {
					x,
					y,
					width,
					height,
				};

				cropRectRef.current = next;

				setCropRect(next);
			},

			onPanResponderRelease: () => {},

			onPanResponderTerminate: () => {},

			onPanResponderTerminationRequest: () => false,
		});
	const topLeftResponder = useMemo(
		() => createResizeResponder("top-left"),
		[],
	);

	const topRightResponder = useMemo(
		() => createResizeResponder("top-right"),
		[],
	);

	const bottomLeftResponder = useMemo(
		() => createResizeResponder("bottom-left"),
		[],
	);

	const bottomRightResponder = useMemo(
		() => createResizeResponder("bottom-right"),
		[],
	);

	const processCurrentCrop = async () => {
		if (
			!device ||
			!selectedImage ||
			!displaySize ||
			previewSize.width <= 0 ||
			previewSize.height <= 0 ||
			cropRect.width <= 0 ||
			cropRect.height <= 0
		) {
			return;
		}

		try {
			setIsProcessing(true);

			const scaleX = selectedImage.width / previewSize.width;

			const scaleY = selectedImage.height / previewSize.height;

			const crop = {
				x: Math.round(cropRect.x * scaleX),
				y: Math.round(cropRect.y * scaleY),
				width: Math.round(cropRect.width * scaleX),
				height: Math.round(cropRect.height * scaleY),
			};

			crop.x = clamp(crop.x, 0, selectedImage.width - crop.width);

			crop.y = clamp(crop.y, 0, selectedImage.height - crop.height);

			const result = await convertToSpectra6GoodDisplayWeb({
				uri: selectedImage.uri,
				crop,
				outputWidth: displaySize.width,
				outputHeight: displaySize.height,
			});

			setProcessedPhoto(result);

			router.push({
				pathname: "/send-photo/[deviceId]/schedule",
				params: {
					deviceId: device.id,
				},
			});
		} catch (error) {
			console.error("Erro ao processar imagem:", error);

			Alert.alert(
				"Erro",
				"Não foi possível processar a imagem para o quadro.",
			);
		} finally {
			setIsProcessing(false);
		}
	};

	const chooseAnotherPhoto = async () => {
		await pickImage();
	};

	if (deviceLoading || !device || !selectedImage || !displaySize) {
		return (
			<View style={styles.centerContainer}>
				<ActivityIndicator size="large" color="#668882" />
			</View>
		);
	}

	return (
		<View style={[styles.screen, compact && styles.screenCompact]}>
			<View style={[styles.card, compact && styles.cardCompact]}>
				<View style={styles.headerRow}>
					<Pressable
						style={({ pressed }) => [
							styles.backButton,
							pressed && styles.pressed,
						]}
						hitSlop={10}
						onPress={() => router.back()}
					>
						<Feather name="arrow-left" size={26} color="#4A4F54" />
					</Pressable>

					<Text
						style={[styles.title, compact && styles.titleCompact]}
					>
						Imprimir foto
					</Text>
				</View>

				<Text
					style={[
						styles.description,
						compact && styles.descriptionCompact,
					]}
				>
					Envie uma foto agendada para{" "}
					<Text style={styles.descriptionStrong}>{device.name}</Text>.
				</Text>

				<View
					style={[
						styles.deviceSummary,
						compact && styles.deviceSummaryCompact,
					]}
				>
					<View style={styles.summaryColumn}>
						<Text style={styles.summaryLabel}>Display</Text>

						<Text style={styles.summaryValue} numberOfLines={1}>
							{getDisplayName(device)}
						</Text>
					</View>

					<View style={styles.summaryDivider} />

					<View style={styles.summaryColumn}>
						<Text style={styles.summaryLabel}>Orientação</Text>

						<Text style={styles.summaryValue}>
							{getOrientationName(device)}
						</Text>
					</View>
				</View>

				<Text style={styles.sectionTitle}>Ajuste o enquadramento</Text>

				<Text style={styles.helperText}>
					Redimensione e mova a área de corte.
				</Text>

				<View
					style={styles.previewArea}
					onLayout={(event) => {
						const { width, height } = event.nativeEvent.layout;

						setPreviewAreaSize((current) => {
							if (
								Math.abs(current.width - width) < 1 &&
								Math.abs(current.height - height) < 1
							) {
								return current;
							}

							return {
								width,
								height,
							};
						});
					}}
				>
					{previewSize.width > 0 && previewSize.height > 0 ? (
						<View style={styles.previewOuter}>
							<View
								style={[
									styles.preview,
									{
										width: previewSize.width,
										height: previewSize.height,
									},
								]}
							>
								<View
									pointerEvents="none"
									style={StyleSheet.absoluteFill}
								>
									<Image
										source={{
											uri: selectedImage.uri,
										}}
										style={styles.previewImage}
										resizeMode="stretch"
									/>
								</View>

								<View
									pointerEvents="none"
									style={[
										styles.overlay,
										{
											left: 0,
											top: 0,
											width: previewSize.width,
											height: cropRect.y,
										},
									]}
								/>

								<View
									pointerEvents="none"
									style={[
										styles.overlay,
										{
											left: 0,
											top: cropRect.y,
											width: cropRect.x,
											height: cropRect.height,
										},
									]}
								/>

								<View
									pointerEvents="none"
									style={[
										styles.overlay,
										{
											left: cropRect.x + cropRect.width,
											top: cropRect.y,
											width: Math.max(
												0,
												previewSize.width -
													cropRect.x -
													cropRect.width,
											),
											height: cropRect.height,
										},
									]}
								/>

								<View
									pointerEvents="none"
									style={[
										styles.overlay,
										{
											left: 0,
											top: cropRect.y + cropRect.height,
											width: previewSize.width,
											height: Math.max(
												0,
												previewSize.height -
													cropRect.y -
													cropRect.height,
											),
										},
									]}
								/>

								<View
									style={[
										styles.cropBox,
										webGestureStyle,
										{
											left: cropRect.x,
											top: cropRect.y,
											width: cropRect.width,
											height: cropRect.height,
										},
									]}
									{...moveResponder.panHandlers}
								>
									<View
										pointerEvents="none"
										style={[
											styles.gridVertical,
											{
												left: "33.333%",
											},
										]}
									/>

									<View
										pointerEvents="none"
										style={[
											styles.gridVertical,
											{
												left: "66.666%",
											},
										]}
									/>

									<View
										pointerEvents="none"
										style={[
											styles.gridHorizontal,
											{
												top: "33.333%",
											},
										]}
									/>

									<View
										pointerEvents="none"
										style={[
											styles.gridHorizontal,
											{
												top: "66.666%",
											},
										]}
									/>
								</View>

								<View
									style={[
										styles.handleHitArea,
										webGestureStyle,
										{
											left:
												cropRect.x -
												stylesConstants.handleHitSize /
													2,
											top:
												cropRect.y -
												stylesConstants.handleHitSize /
													2,
										},
									]}
									{...topLeftResponder.panHandlers}
								>
									<View
										pointerEvents="none"
										style={styles.handleDotCentered}
									/>
								</View>

								<View
									style={[
										styles.handleHitArea,
										webGestureStyle,
										{
											left:
												cropRect.x +
												cropRect.width -
												stylesConstants.handleHitSize /
													2,
											top:
												cropRect.y -
												stylesConstants.handleHitSize /
													2,
										},
									]}
									{...topRightResponder.panHandlers}
								>
									<View
										pointerEvents="none"
										style={styles.handleDotCentered}
									/>
								</View>

								<View
									style={[
										styles.handleHitArea,
										webGestureStyle,
										{
											left:
												cropRect.x -
												stylesConstants.handleHitSize /
													2,
											top:
												cropRect.y +
												cropRect.height -
												stylesConstants.handleHitSize /
													2,
										},
									]}
									{...bottomLeftResponder.panHandlers}
								>
									<View
										pointerEvents="none"
										style={styles.handleDotCentered}
									/>
								</View>

								<View
									style={[
										styles.handleHitArea,
										webGestureStyle,
										{
											left:
												cropRect.x +
												cropRect.width -
												stylesConstants.handleHitSize /
													2,
											top:
												cropRect.y +
												cropRect.height -
												stylesConstants.handleHitSize /
													2,
										},
									]}
									{...bottomRightResponder.panHandlers}
								>
									<View
										pointerEvents="none"
										style={styles.handleDotCentered}
									/>
								</View>
							</View>
						</View>
					) : null}
				</View>

				<View style={styles.actions}>
					<Pressable
						style={({ pressed }) => [
							styles.primaryButton,
							pressed &&
								!isProcessing &&
								styles.primaryButtonPressed,
							isProcessing && styles.disabled,
						]}
						onPress={processCurrentCrop}
						disabled={isProcessing}
					>
						{isProcessing ? (
							<ActivityIndicator color="#FFFFFF" />
						) : (
							<Text style={styles.primaryButtonText}>
								Continuar
							</Text>
						)}
					</Pressable>

					<Pressable
						style={({ pressed }) => [
							styles.secondaryButton,
							pressed && styles.pressed,
						]}
						onPress={chooseAnotherPhoto}
						disabled={isProcessing}
					>
						<Text style={styles.secondaryButtonText}>
							Escolher outra foto
						</Text>
					</Pressable>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: "#FAF9F7",

		alignItems: "center",

		paddingHorizontal: 16,
		paddingVertical: 14,
	},

	screenCompact: {
		paddingHorizontal: 10,
		paddingVertical: 10,
	},

	centerContainer: {
		flex: 1,
		backgroundColor: "#FAF9F7",

		alignItems: "center",
		justifyContent: "center",
	},

	card: {
		flex: 1,

		width: "100%",
		maxWidth: 720,
		minHeight: 0,

		backgroundColor: "#FFFFFF",

		borderRadius: 24,

		paddingHorizontal: 24,
		paddingTop: 14,
		paddingBottom: 12,

		shadowColor: "#000000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.06,
		shadowRadius: 8,

		elevation: 2,
	},

	cardCompact: {
		borderRadius: 20,

		paddingHorizontal: 14,
		paddingTop: 12,
		paddingBottom: 10,
	},

	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},

	backButton: {
		width: 32,
		height: 34,

		alignItems: "flex-start",
		justifyContent: "center",
	},

	title: {
		fontSize: 30,
		lineHeight: 36,
		fontWeight: "700",

		color: "#1A1A1A",
	},

	titleCompact: {
		fontSize: 24,
		lineHeight: 30,
	},

	description: {
		marginTop: 2,
		marginBottom: 6,

		fontSize: 15,
		lineHeight: 21,

		color: "#666666",
	},

	descriptionCompact: {
		marginBottom: 6,
	},

	descriptionStrong: {
		fontWeight: "700",
		color: "#1A1A1A",
	},

	deviceSummary: {
		minHeight: 62,

		borderWidth: 1,
		borderColor: "#EEEEEEEE",
		borderRadius: 12,

		backgroundColor: "#FFFFFF",

		flexDirection: "row",
		alignItems: "center",

		paddingHorizontal: 16,
		paddingVertical: 8,

		marginBottom: 12,
	},

	deviceSummaryCompact: {
		minHeight: 66,

		paddingHorizontal: 14,
		paddingVertical: 9,

		marginBottom: 12,
	},

	summaryColumn: {
		flex: 1,
	},

	summaryDivider: {
		width: StyleSheet.hairlineWidth,
		height: "70%",

		backgroundColor: "#EEEEEEEE",

		marginHorizontal: 12,
	},

	summaryLabel: {
		fontSize: 13,
		lineHeight: 18,

		color: "#888888",
	},

	summaryValue: {
		marginTop: 2,

		fontSize: 16,
		lineHeight: 21,
		fontWeight: "600",

		color: "#1A1A1A",
	},

	sectionTitle: {
		fontSize: 20,
		lineHeight: 25,
		fontWeight: "700",

		color: "#1A1A1A",
	},

	helperText: {
		marginTop: 1,
		marginBottom: 10,

		fontSize: 14,
		lineHeight: 19,

		color: "#666666",
	},

	previewArea: {
		flex: 1,
		minHeight: 0,

		alignItems: "center",
		justifyContent: "center",
	},

	previewOuter: {
		alignSelf: "center",

		borderWidth: 1,
		borderColor: "#EEEEEE",
		borderRadius: 14,

		padding: 2,

		backgroundColor: "#FFFFFF",
	},

	preview: {
		position: "relative",

		borderRadius: 12,
		overflow: "hidden",

		backgroundColor: "#F4F5F4",
	},

	previewImage: {
		width: "100%",
		height: "100%",
	},

	overlay: {
		position: "absolute",

		backgroundColor: "rgba(0, 0, 0, 0.32)",
	},

	cropBox: {
		position: "absolute",

		borderWidth: 2,
		borderColor: "#FFFFFF",
	},

	gridVertical: {
		position: "absolute",

		top: 0,
		bottom: 0,

		width: StyleSheet.hairlineWidth,

		backgroundColor: "rgba(255,255,255,0.8)",
	},

	gridHorizontal: {
		position: "absolute",

		left: 0,
		right: 0,

		height: StyleSheet.hairlineWidth,

		backgroundColor: "rgba(255,255,255,0.8)",
	},

	handleHitArea: {
		position: "absolute",

		width: stylesConstants.handleHitSize,
		height: stylesConstants.handleHitSize,

		zIndex: 30,

		alignItems: "center",
		justifyContent: "center",
	},

	handleDotCentered: {
		width: stylesConstants.handleDotSize,
		height: stylesConstants.handleDotSize,

		borderRadius: stylesConstants.handleDotSize / 2,

		backgroundColor: "#FFFFFF",

		borderWidth: 1,
		borderColor: "rgba(0,0,0,0.12)",
	},

	actions: {
		flexShrink: 0,

		marginTop: 8,
		paddingTop: 0,
	},

	primaryButton: {
		minHeight: 46,

		paddingHorizontal: 16,
		paddingVertical: 12,

		borderRadius: 12,

		backgroundColor: "#668882",

		alignItems: "center",
		justifyContent: "center",
	},

	primaryButtonPressed: {
		backgroundColor: "#4e6863",
	},

	primaryButtonText: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: "600",

		color: "#FFFFFF",
		textAlign: "center",
	},

	secondaryButton: {
		minHeight: 46,

		marginTop: 6,

		paddingHorizontal: 16,
		paddingVertical: 12,

		borderWidth: 1,
		borderColor: "#EEEEEEEE",
		borderRadius: 12,

		backgroundColor: "#FFFFFF",

		alignItems: "center",
		justifyContent: "center",
	},

	secondaryButtonText: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: "600",

		color: "#1A1A1A",
		textAlign: "center",
	},

	disabled: {
		opacity: 0.5,
	},

	pressed: {
		opacity: 0.72,
	},
});
