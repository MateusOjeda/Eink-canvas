import { useCallback, useEffect, useMemo, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "../firebase/config";

import { signInWithGoogle, signOutUser } from "../firebase/auth";

import {
	getAuthorizedDevices,
	type AuthorizedDevice,
} from "../firebase/permissions";

import { uploadTemporaryPhoto } from "../firebase/photos";

import { getDisplaySize } from "../constants/displays";

import { convertToSpectra6GoodDisplayWeb } from "../image-processing/spectra6/good-display-web";

type SelectedImage = {
	uri: string;
	width: number;
	height: number;
};

type FlowStep = "pick" | "crop" | "schedule" | "success";

type ProcessedTemporaryPhoto = {
	previewBlob: Blob;
	binBytes: Uint8Array;
	width: number;
	height: number;
};

const DURATION_OPTIONS = [
	{ label: "30 min", minutes: 30 },
	{ label: "1 hora", minutes: 60 },
	{ label: "2 horas", minutes: 120 },
	{ label: "3 horas", minutes: 180 },
] as const;

const MOVE_STEP = 15;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function getDisplayName(device: AuthorizedDevice): string {
	if (device.displayType === "spectra6-7.3") {
		return 'Spectra 6 — 7,3"';
	}

	if (device.displayType === "spectra6-13.3") {
		return 'Spectra 6 — 13,3"';
	}

	return device.displayType;
}

function getOrientationName(device: AuthorizedDevice): string {
	return device.orientation === "portrait" ? "Retrato" : "Paisagem";
}

function getCropFrameSize(targetWidth: number, targetHeight: number) {
	const maxWidth = 320;
	const maxHeight = 420;

	const ratio = targetWidth / targetHeight;

	let width = maxWidth;
	let height = width / ratio;

	if (height > maxHeight) {
		height = maxHeight;
		width = height * ratio;
	}

	return {
		width,
		height,
	};
}

function getDisplayedImageSize(
	imageWidth: number,
	imageHeight: number,
	frameWidth: number,
	frameHeight: number,
	zoom: number,
) {
	const imageRatio = imageWidth / imageHeight;
	const frameRatio = frameWidth / frameHeight;

	let baseWidth = 0;
	let baseHeight = 0;

	if (imageRatio > frameRatio) {
		baseHeight = frameHeight;
		baseWidth = baseHeight * imageRatio;
	} else {
		baseWidth = frameWidth;
		baseHeight = baseWidth / imageRatio;
	}

	return {
		width: baseWidth * zoom,
		height: baseHeight * zoom,
	};
}

function clampCropOffsets({
	offsetX,
	offsetY,
	displayedWidth,
	displayedHeight,
	frameWidth,
	frameHeight,
}: {
	offsetX: number;
	offsetY: number;
	displayedWidth: number;
	displayedHeight: number;
	frameWidth: number;
	frameHeight: number;
}) {
	const maxOffsetX = Math.max(0, (displayedWidth - frameWidth) / 2);
	const maxOffsetY = Math.max(0, (displayedHeight - frameHeight) / 2);

	return {
		offsetX: clamp(offsetX, -maxOffsetX, maxOffsetX),
		offsetY: clamp(offsetY, -maxOffsetY, maxOffsetY),
	};
}

function buildCropRect({
	sourceWidth,
	sourceHeight,
	frameWidth,
	frameHeight,
	displayedWidth,
	displayedHeight,
	offsetX,
	offsetY,
}: {
	sourceWidth: number;
	sourceHeight: number;
	frameWidth: number;
	frameHeight: number;
	displayedWidth: number;
	displayedHeight: number;
	offsetX: number;
	offsetY: number;
}) {
	const left = (frameWidth - displayedWidth) / 2 + offsetX;
	const top = (frameHeight - displayedHeight) / 2 + offsetY;

	const cropWidth = (frameWidth / displayedWidth) * sourceWidth;
	const cropHeight = (frameHeight / displayedHeight) * sourceHeight;

	let x = (-left / displayedWidth) * sourceWidth;
	let y = (-top / displayedHeight) * sourceHeight;

	x = clamp(x, 0, sourceWidth - cropWidth);
	y = clamp(y, 0, sourceHeight - cropHeight);

	return {
		x: Math.round(x),
		y: Math.round(y),
		width: Math.round(cropWidth),
		height: Math.round(cropHeight),
	};
}

export default function HomeScreen() {
	const [user, setUser] = useState<User | null>(null);

	const [loading, setLoading] = useState(true);

	const [signingIn, setSigningIn] = useState(false);

	const [checkingPermission, setCheckingPermission] = useState(false);

	const [refreshing, setRefreshing] = useState(false);

	const [authorizedDevices, setAuthorizedDevices] = useState<
		AuthorizedDevice[] | null
	>(null);

	const [permissionError, setPermissionError] = useState(false);

	const [selectedDevice, setSelectedDevice] =
		useState<AuthorizedDevice | null>(null);

	const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(
		null,
	);

	const [flowStep, setFlowStep] = useState<FlowStep>("pick");

	const [cropZoom, setCropZoom] = useState(1);
	const [cropOffsetX, setCropOffsetX] = useState(0);
	const [cropOffsetY, setCropOffsetY] = useState(0);

	const [processedPhoto, setProcessedPhoto] =
		useState<ProcessedTemporaryPhoto | null>(null);

	const [isProcessing, setIsProcessing] = useState(false);
	const [isSending, setIsSending] = useState(false);

	const [durationMinutes, setDurationMinutes] = useState(60);

	const [sendError, setSendError] = useState<string | null>(null);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			setUser(currentUser);
			setLoading(false);
		});

		return unsubscribe;
	}, []);

	const loadPermissions = useCallback(
		async (isRefresh = false) => {
			if (!user) {
				return;
			}

			try {
				if (isRefresh) {
					setRefreshing(true);
				} else {
					setCheckingPermission(true);
				}

				setPermissionError(false);

				const devices = await getAuthorizedDevices(user.uid);

				setAuthorizedDevices(devices);
			} catch (error) {
				console.error("Erro ao carregar autorizações:", error);

				setPermissionError(true);
			} finally {
				if (isRefresh) {
					setRefreshing(false);
				} else {
					setCheckingPermission(false);
				}
			}
		},
		[user],
	);

	useEffect(() => {
		if (!user) {
			setAuthorizedDevices(null);
			setPermissionError(false);

			setSelectedDevice(null);
			setSelectedImage(null);
			setProcessedPhoto(null);
			setFlowStep("pick");

			return;
		}

		loadPermissions();
	}, [user, loadPermissions]);

	const handleSignIn = async () => {
		try {
			setSigningIn(true);

			await signInWithGoogle();
		} catch (error) {
			console.error("Erro ao entrar com Google:", error);
		} finally {
			setSigningIn(false);
		}
	};

	const resetCrop = () => {
		setCropZoom(1);
		setCropOffsetX(0);
		setCropOffsetY(0);
	};

	const resetSelectedFlow = () => {
		setSelectedImage(null);
		setProcessedPhoto(null);
		setFlowStep("pick");
		resetCrop();
		setDurationMinutes(60);
	};

	const selectDevice = (device: AuthorizedDevice) => {
		setSelectedDevice(device);
		resetSelectedFlow();
	};

	const backToDevices = () => {
		setSelectedDevice(null);
		resetSelectedFlow();
	};

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

		if (!image.width || !image.height) {
			Alert.alert(
				"Erro",
				"A imagem selecionada não possui dimensões válidas.",
			);

			return;
		}

		setSelectedImage({
			uri: image.uri,
			width: image.width,
			height: image.height,
		});

		setProcessedPhoto(null);
		setFlowStep("crop");
		resetCrop();
	};

	const displaySize = useMemo(() => {
		if (!selectedDevice) {
			return null;
		}

		return getDisplaySize(
			selectedDevice.displayType,
			selectedDevice.orientation,
		);
	}, [selectedDevice]);

	const cropFrame = useMemo(() => {
		if (!displaySize) {
			return null;
		}

		return getCropFrameSize(displaySize.width, displaySize.height);
	}, [displaySize]);

	const displayedImageSize = useMemo(() => {
		if (!selectedImage || !cropFrame) {
			return null;
		}

		return getDisplayedImageSize(
			selectedImage.width,
			selectedImage.height,
			cropFrame.width,
			cropFrame.height,
			cropZoom,
		);
	}, [selectedImage, cropFrame, cropZoom]);

	const moveCrop = (dx: number, dy: number) => {
		if (!displayedImageSize || !cropFrame) {
			return;
		}

		const next = clampCropOffsets({
			offsetX: cropOffsetX + dx,
			offsetY: cropOffsetY + dy,
			displayedWidth: displayedImageSize.width,
			displayedHeight: displayedImageSize.height,
			frameWidth: cropFrame.width,
			frameHeight: cropFrame.height,
		});

		setCropOffsetX(next.offsetX);
		setCropOffsetY(next.offsetY);
	};

	const changeZoom = (delta: number) => {
		if (!selectedImage || !cropFrame) {
			return;
		}

		const nextZoom = clamp(
			Number((cropZoom + delta).toFixed(2)),
			MIN_ZOOM,
			MAX_ZOOM,
		);

		const nextDisplayed = getDisplayedImageSize(
			selectedImage.width,
			selectedImage.height,
			cropFrame.width,
			cropFrame.height,
			nextZoom,
		);

		const nextOffsets = clampCropOffsets({
			offsetX: cropOffsetX,
			offsetY: cropOffsetY,
			displayedWidth: nextDisplayed.width,
			displayedHeight: nextDisplayed.height,
			frameWidth: cropFrame.width,
			frameHeight: cropFrame.height,
		});

		setCropZoom(nextZoom);
		setCropOffsetX(nextOffsets.offsetX);
		setCropOffsetY(nextOffsets.offsetY);
	};

	const processCurrentCrop = async () => {
		if (
			!selectedDevice ||
			!selectedImage ||
			!displaySize ||
			!cropFrame ||
			!displayedImageSize
		) {
			return;
		}

		try {
			setIsProcessing(true);

			const crop = buildCropRect({
				sourceWidth: selectedImage.width,
				sourceHeight: selectedImage.height,
				frameWidth: cropFrame.width,
				frameHeight: cropFrame.height,
				displayedWidth: displayedImageSize.width,
				displayedHeight: displayedImageSize.height,
				offsetX: cropOffsetX,
				offsetY: cropOffsetY,
			});

			const result = await convertToSpectra6GoodDisplayWeb({
				uri: selectedImage.uri,
				crop,
				outputWidth: displaySize.width,
				outputHeight: displaySize.height,
			});

			setProcessedPhoto(result);
			setFlowStep("schedule");
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

	const sendTemporaryPhoto = async () => {
		if (!selectedDevice || !processedPhoto) {
			return;
		}

		try {
			setIsSending(true);
			setSendError(null);

			await uploadTemporaryPhoto({
				deviceId: selectedDevice.id,

				preview: processedPhoto.previewBlob,
				bin: processedPhoto.binBytes,

				width: processedPhoto.width,
				height: processedPhoto.height,

				durationMinutes,
			});

			setFlowStep("success");
		} catch (error) {
			console.error("Erro ao enviar foto agendada:", error);

			setSendError("Não foi possível enviar a foto. Tente novamente.");
		} finally {
			setIsSending(false);
		}
	};

	if (loading) {
		return (
			<View style={styles.centerContainer}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (!user) {
		return (
			<View style={styles.centerContainer}>
				<View style={styles.card}>
					<Text style={styles.title}>Quadro E-ink</Text>

					<Text style={styles.description}>
						Entre com sua conta Google para continuar.
					</Text>

					<Pressable
						style={styles.primaryButton}
						onPress={handleSignIn}
						disabled={signingIn}
					>
						<Text style={styles.primaryButtonText}>
							{signingIn ? "Entrando..." : "Entrar com Google"}
						</Text>
					</Pressable>
				</View>
			</View>
		);
	}

	if (checkingPermission || authorizedDevices === null) {
		return (
			<View style={styles.centerContainer}>
				<ActivityIndicator size="large" />

				<Text style={styles.loadingText}>
					Verificando autorização...
				</Text>
			</View>
		);
	}

	if (permissionError) {
		return (
			<View style={styles.centerContainer}>
				<View style={styles.card}>
					<Text style={styles.title}>Erro</Text>

					<Text style={styles.description}>
						Não foi possível verificar suas autorizações.
					</Text>

					<View style={styles.inlineButtons}>
						<Pressable
							style={styles.inlineSecondaryButton}
							onPress={() => {
								loadPermissions(true);
							}}
						>
							{refreshing ? (
								<ActivityIndicator size="small" />
							) : (
								<Text style={styles.inlineSecondaryButtonText}>
									Tentar de novo
								</Text>
							)}
						</Pressable>

						<Pressable
							style={styles.inlineSecondaryButton}
							onPress={signOutUser}
						>
							<Text style={styles.inlineSecondaryButtonText}>
								Sair
							</Text>
						</Pressable>
					</View>
				</View>
			</View>
		);
	}

	if (authorizedDevices.length === 0) {
		return (
			<View style={styles.centerContainer}>
				<View style={styles.card}>
					<Text style={styles.title}>Aguardando autorização</Text>

					<Text style={styles.description}>
						Sua conta foi identificada, mas ainda não possui acesso
						a nenhum quadro.
					</Text>

					<Text style={styles.label}>E-mail</Text>

					<Text style={styles.value}>{user.email ?? "—"}</Text>

					<Text style={styles.label}>UID</Text>

					<Text style={styles.uid} selectable>
						{user.uid}
					</Text>

					<View style={styles.inlineButtons}>
						<Pressable
							style={styles.inlineSecondaryButton}
							onPress={() => {
								loadPermissions(true);
							}}
						>
							{refreshing ? (
								<ActivityIndicator size="small" />
							) : (
								<Text style={styles.inlineSecondaryButtonText}>
									Atualizar
								</Text>
							)}
						</Pressable>

						<Pressable
							style={styles.inlineSecondaryButton}
							onPress={signOutUser}
						>
							<Text style={styles.inlineSecondaryButtonText}>
								Sair
							</Text>
						</Pressable>
					</View>
				</View>
			</View>
		);
	}

	if (selectedDevice) {
		return (
			<>
				<ScrollView
					style={styles.screen}
					contentContainerStyle={styles.screenContent}
				>
					<View style={styles.card}>
						<Text style={styles.title}>Enviar foto</Text>

						<Text style={styles.description}>
							Envie uma foto agendada para{" "}
							<Text style={styles.descriptionStrong}>
								{selectedDevice.name}
							</Text>
							.
						</Text>

						<View style={styles.deviceSummary}>
							<View>
								<Text style={styles.summaryLabel}>Display</Text>

								<Text style={styles.summaryValue}>
									{getDisplayName(selectedDevice)}
								</Text>
							</View>

							<View>
								<Text style={styles.summaryLabel}>
									Orientação
								</Text>

								<Text style={styles.summaryValue}>
									{getOrientationName(selectedDevice)}
								</Text>
							</View>
						</View>

						{flowStep === "pick" && (
							<>
								<View style={styles.imagePlaceholder}>
									<Text style={styles.imagePlaceholderText}>
										Nenhuma foto selecionada
									</Text>
								</View>

								<Pressable
									style={styles.primaryButton}
									onPress={pickImage}
								>
									<Text style={styles.primaryButtonText}>
										Escolher foto
									</Text>
								</Pressable>
							</>
						)}

						{flowStep === "crop" &&
							selectedImage &&
							cropFrame &&
							displayedImageSize && (
								<>
									<Text style={styles.sectionTitle}>
										Ajuste o enquadramento
									</Text>

									<Text style={styles.helperText}>
										A imagem será cortada exatamente nessa
										proporção antes do envio.
									</Text>

									<View
										style={[
											styles.cropFrame,
											{
												width: cropFrame.width,
												height: cropFrame.height,
											},
										]}
									>
										<Image
											source={{
												uri: selectedImage.uri,
											}}
											style={{
												position: "absolute",
												width: displayedImageSize.width,
												height: displayedImageSize.height,
												left:
													(cropFrame.width -
														displayedImageSize.width) /
														2 +
													cropOffsetX,
												top:
													(cropFrame.height -
														displayedImageSize.height) /
														2 +
													cropOffsetY,
											}}
											resizeMode="stretch"
										/>
									</View>

									<Text style={styles.imageInfoText}>
										Imagem original: {selectedImage.width} ×{" "}
										{selectedImage.height}
									</Text>

									<View style={styles.controlsBlock}>
										<Text style={styles.controlLabel}>
											Zoom
										</Text>

										<View style={styles.rowControls}>
											<Pressable
												style={styles.controlButton}
												onPress={() =>
													changeZoom(-ZOOM_STEP)
												}
											>
												<Text
													style={
														styles.controlButtonText
													}
												>
													−
												</Text>
											</Pressable>

											<Text style={styles.zoomValue}>
												{Math.round(cropZoom * 100)}%
											</Text>

											<Pressable
												style={styles.controlButton}
												onPress={() =>
													changeZoom(ZOOM_STEP)
												}
											>
												<Text
													style={
														styles.controlButtonText
													}
												>
													+
												</Text>
											</Pressable>
										</View>
									</View>

									<View style={styles.controlsBlock}>
										<Text style={styles.controlLabel}>
											Posição
										</Text>

										<View style={styles.positionGrid}>
											<View
												style={
													styles.positionGridSpacer
												}
											/>

											<Pressable
												style={styles.controlButton}
												onPress={() =>
													moveCrop(0, -MOVE_STEP)
												}
											>
												<Text
													style={
														styles.controlButtonText
													}
												>
													↑
												</Text>
											</Pressable>

											<View
												style={
													styles.positionGridSpacer
												}
											/>

											<Pressable
												style={styles.controlButton}
												onPress={() =>
													moveCrop(-MOVE_STEP, 0)
												}
											>
												<Text
													style={
														styles.controlButtonText
													}
												>
													←
												</Text>
											</Pressable>

											<Pressable
												style={styles.controlButton}
												onPress={resetCrop}
											>
												<Text
													style={
														styles.controlButtonText
													}
												>
													•
												</Text>
											</Pressable>

											<Pressable
												style={styles.controlButton}
												onPress={() =>
													moveCrop(MOVE_STEP, 0)
												}
											>
												<Text
													style={
														styles.controlButtonText
													}
												>
													→
												</Text>
											</Pressable>

											<View
												style={
													styles.positionGridSpacer
												}
											/>

											<Pressable
												style={styles.controlButton}
												onPress={() =>
													moveCrop(0, MOVE_STEP)
												}
											>
												<Text
													style={
														styles.controlButtonText
													}
												>
													↓
												</Text>
											</Pressable>

											<View
												style={
													styles.positionGridSpacer
												}
											/>
										</View>
									</View>

									<Pressable
										style={styles.primaryButton}
										onPress={processCurrentCrop}
										disabled={isProcessing}
									>
										{isProcessing ? (
											<ActivityIndicator color="#ffffff" />
										) : (
											<Text
												style={styles.primaryButtonText}
											>
												Continuar
											</Text>
										)}
									</Pressable>

									<Pressable
										style={styles.secondaryButton}
										onPress={pickImage}
										disabled={isProcessing}
									>
										<Text
											style={styles.secondaryButtonText}
										>
											Escolher outra foto
										</Text>
									</Pressable>
								</>
							)}

						{flowStep === "schedule" && processedPhoto && (
							<>
								<View style={styles.readyBox}>
									<Text style={styles.readyTitle}>
										Foto pronta para envio
									</Text>

									<Text style={styles.readyText}>
										A foto já foi processada para o quadro.
										O convidado não precisa ver o preview
										processado.
									</Text>
								</View>

								<View style={styles.resultInfoBox}>
									<Text style={styles.resultInfoText}>
										Resolução final: {processedPhoto.width}{" "}
										× {processedPhoto.height}
									</Text>

									<Text style={styles.resultInfoText}>
										Algoritmo: Good Display Floyd-Steinberg
									</Text>
								</View>

								<Text style={styles.sectionTitle}>Duração</Text>

								<Text style={styles.helperText}>
									A duração começa quando a foto for exibida
									no quadro.
								</Text>

								<View style={styles.durationOptions}>
									{DURATION_OPTIONS.map((option) => {
										const selected =
											durationMinutes === option.minutes;

										return (
											<Pressable
												key={option.minutes}
												style={[
													styles.durationOption,
													selected &&
														styles.durationOptionSelected,
												]}
												onPress={() => {
													setDurationMinutes(
														option.minutes,
													);
													setSendError(null);
												}}
											>
												<Text
													style={[
														styles.durationOptionText,
														selected &&
															styles.durationOptionTextSelected,
													]}
												>
													{option.label}
												</Text>
											</Pressable>
										);
									})}
								</View>

								<Pressable
									disabled={isSending}
									style={[
										styles.primaryButton,
										isSending && styles.buttonDisabled,
									]}
									onPress={sendTemporaryPhoto}
								>
									{isSending ? (
										<ActivityIndicator color="#ffffff" />
									) : (
										<Text style={styles.primaryButtonText}>
											Enviar foto agendada
										</Text>
									)}
								</Pressable>

								{sendError && (
									<Text style={styles.sendError}>
										{sendError}
									</Text>
								)}
							</>
						)}

						{flowStep === "success" && (
							<View style={styles.successContainer}>
								<View style={styles.successIcon}>
									<Text style={styles.successIconText}>
										✓
									</Text>
								</View>

								<Text style={styles.successTitle}>
									Foto enviada
								</Text>

								<Text style={styles.successDescription}>
									A foto agendada foi enviada para{" "}
									<Text style={styles.descriptionStrong}>
										{selectedDevice.name}
									</Text>
									.
								</Text>

								<Pressable
									style={styles.primaryButton}
									onPress={backToDevices}
								>
									<Text style={styles.primaryButtonText}>
										Voltar aos quadros
									</Text>
								</Pressable>
							</View>
						)}

						{flowStep !== "success" && (
							<Pressable
								style={styles.secondaryButton}
								onPress={backToDevices}
								disabled={isProcessing || isSending}
							>
								<Text style={styles.secondaryButtonText}>
									Cancelar
								</Text>
							</Pressable>
						)}
					</View>
				</ScrollView>
			</>
		);
	}

	return (
		<ScrollView
			style={styles.screen}
			contentContainerStyle={styles.screenContent}
		>
			<View style={styles.card}>
				<View style={styles.headerRow}>
					<Text style={styles.title}>Escolha um quadro</Text>

					<Pressable
						style={styles.headerActionButton}
						onPress={() => {
							loadPermissions(true);
						}}
					>
						{refreshing ? (
							<ActivityIndicator size="small" />
						) : (
							<Text style={styles.headerActionButtonText}>
								Atualizar
							</Text>
						)}
					</Pressable>
				</View>

				<Text style={styles.description}>
					Você tem permissão para enviar uma foto agendada para:
				</Text>

				{authorizedDevices.map((device) => (
					<View key={device.id} style={styles.device}>
						<View style={styles.deviceInfo}>
							<Text style={styles.deviceName}>{device.name}</Text>

							<Text style={styles.deviceId}>{device.id}</Text>
						</View>

						<Pressable
							style={styles.deviceButton}
							onPress={() => {
								selectDevice(device);
							}}
						>
							<Text style={styles.deviceButtonText}>
								Enviar foto
							</Text>
						</Pressable>
					</View>
				))}

				<Pressable style={styles.secondaryButton} onPress={signOutUser}>
					<Text style={styles.secondaryButtonText}>Sair</Text>
				</Pressable>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: "#FBF7F3",
	},

	screenContent: {
		flexGrow: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},

	centerContainer: {
		flex: 1,
		backgroundColor: "#FBF7F3",
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},

	card: {
		width: "100%",
		maxWidth: 560,
		backgroundColor: "#ffffff",
		borderRadius: 16,
		padding: 28,
	},

	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 16,
		marginBottom: 12,
	},

	title: {
		fontSize: 28,
		fontWeight: "700",
		color: "#222222",
	},

	description: {
		fontSize: 16,
		lineHeight: 22,
		color: "#666666",
		marginBottom: 28,
	},

	descriptionStrong: {
		fontWeight: "600",
		color: "#222222",
	},

	label: {
		marginTop: 16,
		fontSize: 13,
		fontWeight: "600",
		color: "#777777",
	},

	value: {
		marginTop: 4,
		fontSize: 16,
		color: "#222222",
	},

	uid: {
		marginTop: 4,
		fontSize: 14,
		color: "#222222",
	},

	loadingText: {
		marginTop: 16,
		fontSize: 15,
		color: "#666666",
	},

	headerActionButton: {
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#cccccc",
		minWidth: 98,
		alignItems: "center",
		justifyContent: "center",
	},

	headerActionButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#333333",
	},

	primaryButton: {
		backgroundColor: "#111111",
		borderRadius: 12,
		paddingVertical: 15,
		paddingHorizontal: 24,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 50,
	},

	primaryButtonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},

	secondaryButton: {
		marginTop: 18,
		borderWidth: 1,
		borderColor: "#cccccc",
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: "center",
	},

	secondaryButtonText: {
		fontSize: 15,
		fontWeight: "600",
		color: "#333333",
	},

	inlineButtons: {
		flexDirection: "row",
		gap: 12,
		marginTop: 24,
	},

	inlineSecondaryButton: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#cccccc",
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
		minHeight: 48,
	},

	inlineSecondaryButtonText: {
		fontSize: 15,
		fontWeight: "600",
		color: "#333333",
	},

	device: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: 16,
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#eeeeee",
	},

	deviceInfo: {
		flex: 1,
	},

	deviceName: {
		fontSize: 16,
		fontWeight: "600",
		color: "#222222",
	},

	deviceId: {
		marginTop: 4,
		fontSize: 12,
		color: "#888888",
	},

	deviceButton: {
		backgroundColor: "#111111",
		borderRadius: 10,
		paddingHorizontal: 16,
		paddingVertical: 11,
	},

	deviceButtonText: {
		color: "#ffffff",
		fontSize: 14,
		fontWeight: "600",
	},

	deviceSummary: {
		flexDirection: "row",
		gap: 36,
		padding: 16,
		marginBottom: 20,
		borderRadius: 12,
		backgroundColor: "#f7f7f7",
	},

	summaryLabel: {
		fontSize: 12,
		color: "#888888",
	},

	summaryValue: {
		marginTop: 3,
		fontSize: 14,
		fontWeight: "600",
		color: "#222222",
	},

	imagePlaceholder: {
		height: 260,
		borderWidth: 1,
		borderColor: "#dddddd",
		borderRadius: 12,
		backgroundColor: "#f7f7f7",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 14,
	},

	imagePlaceholderText: {
		fontSize: 14,
		color: "#888888",
	},

	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#222222",
		marginBottom: 8,
	},

	helperText: {
		fontSize: 14,
		lineHeight: 20,
		color: "#666666",
		marginBottom: 14,
	},

	cropFrame: {
		alignSelf: "center",
		borderRadius: 12,
		overflow: "hidden",
		backgroundColor: "#f0f0f0",
		borderWidth: 1,
		borderColor: "#dddddd",
		marginBottom: 14,
	},

	imageInfoText: {
		fontSize: 12,
		color: "#888888",
		textAlign: "center",
		marginBottom: 16,
	},

	controlsBlock: {
		marginBottom: 18,
	},

	controlLabel: {
		fontSize: 13,
		fontWeight: "600",
		color: "#666666",
		marginBottom: 10,
		textAlign: "center",
	},

	rowControls: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 12,
	},

	controlButton: {
		width: 46,
		height: 46,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#dddddd",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#ffffff",
	},

	controlButtonText: {
		fontSize: 22,
		fontWeight: "600",
		color: "#222222",
	},

	zoomValue: {
		minWidth: 72,
		textAlign: "center",
		fontSize: 15,
		fontWeight: "600",
		color: "#222222",
	},

	positionGrid: {
		width: 170,
		alignSelf: "center",
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: 8,
	},

	positionGridSpacer: {
		width: 46,
		height: 46,
	},

	readyBox: {
		padding: 16,
		borderRadius: 12,
		backgroundColor: "#f7f7f7",
		marginBottom: 16,
	},

	readyTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#222222",
		marginBottom: 6,
	},

	readyText: {
		fontSize: 14,
		lineHeight: 20,
		color: "#666666",
	},

	resultInfoBox: {
		marginBottom: 18,
		gap: 4,
	},

	resultInfoText: {
		fontSize: 14,
		color: "#555555",
	},

	durationOptions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
		marginBottom: 18,
	},

	durationOption: {
		width: "48%",
		flexGrow: 1,
		borderWidth: 1,
		borderColor: "#dddddd",
		borderRadius: 12,
		paddingVertical: 14,
		paddingHorizontal: 12,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#ffffff",
	},

	durationOptionSelected: {
		backgroundColor: "#111111",
		borderColor: "#111111",
	},

	durationOptionText: {
		fontSize: 15,
		fontWeight: "600",
		color: "#333333",
	},

	durationOptionTextSelected: {
		color: "#ffffff",
	},

	buttonDisabled: {
		backgroundColor: "#bdbdbd",
	},

	successContainer: {
		alignItems: "center",

		paddingVertical: 24,
	},

	successIcon: {
		width: 64,
		height: 64,

		borderRadius: 32,

		backgroundColor: "#111111",

		alignItems: "center",
		justifyContent: "center",

		marginBottom: 20,
	},

	successIconText: {
		color: "#ffffff",

		fontSize: 32,
		fontWeight: "700",

		lineHeight: 36,
	},

	successTitle: {
		fontSize: 24,
		fontWeight: "700",

		color: "#222222",

		marginBottom: 10,
	},

	successDescription: {
		fontSize: 15,
		lineHeight: 22,

		color: "#666666",

		textAlign: "center",

		marginBottom: 28,
	},

	sendError: {
		marginTop: 10,

		fontSize: 13,
		lineHeight: 18,

		color: "#b00020",

		textAlign: "center",
	},
});
