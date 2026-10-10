import { useEffect, useState } from "react";

import {
	ActivityIndicator,
	Image,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";

import { router } from "expo-router";

import { Feather } from "@expo/vector-icons";

import { uploadTemporaryPhoto } from "../../../firebase/photos";

import { useSendPhotoFlow } from "../../../contexts/SendPhotoFlowContext";

import {
	DURATION_OPTIONS,
	getDisplayName,
	getOrientationName,
} from "../../../utils/web-photo-flow";

export default function SchedulePhotoScreen() {
	const { width, height } = useWindowDimensions();

	const compact = width < 420;
	const short = height < 720;

	const {
		device,
		deviceLoading,
		selectedImage,
		processedPhoto,
		durationMinutes,
		setDurationMinutes,
		sendError,
		setSendError,
	} = useSendPhotoFlow();

	const [isSending, setIsSending] = useState(false);

	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	useEffect(() => {
		if (!processedPhoto?.previewBlob) {
			setPreviewUrl(null);
			return;
		}

		const url = URL.createObjectURL(processedPhoto.previewBlob);

		setPreviewUrl(url);

		return () => {
			URL.revokeObjectURL(url);
		};
	}, [processedPhoto?.previewBlob]);

	useEffect(() => {
		if (!deviceLoading && device && !processedPhoto) {
			router.replace({
				pathname: selectedImage
					? "/send-photo/[deviceId]/crop"
					: "/send-photo/[deviceId]",
				params: {
					deviceId: device.id,
				},
			});
		}
	}, [deviceLoading, device, processedPhoto, selectedImage]);

	const sendTemporaryPhoto = async () => {
		if (!device || !processedPhoto) {
			return;
		}

		try {
			setIsSending(true);
			setSendError(null);

			await uploadTemporaryPhoto({
				deviceId: device.id,

				preview: processedPhoto.previewBlob,
				bin: processedPhoto.binBytes,

				width: processedPhoto.width,
				height: processedPhoto.height,

				durationMinutes,
			});

			router.replace({
				pathname: "/send-photo/[deviceId]/success",
				params: {
					deviceId: device.id,
				},
			});
		} catch (error) {
			console.error("Erro ao enviar foto agendada:", error);

			setSendError("Não foi possível enviar a foto. Tente novamente.");
		} finally {
			setIsSending(false);
		}
	};

	if (deviceLoading || !device || !processedPhoto) {
		return (
			<View style={styles.centerContainer}>
				<ActivityIndicator size="large" color="#668882" />
			</View>
		);
	}

	return (
		<View style={[styles.screen, compact && styles.screenCompact]}>
			<View
				style={[
					styles.card,
					compact && styles.cardCompact,
					short && styles.cardShort,
				]}
			>
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
						short && styles.descriptionShort,
					]}
				>
					Agende uma impressão para{" "}
					<Text style={styles.descriptionStrong}>{device.name}</Text>.
				</Text>

				<View
					style={[
						styles.deviceSummary,
						compact && styles.deviceSummaryCompact,
						short && styles.deviceSummaryShort,
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

				<View style={[styles.readyBox, short && styles.readyBoxShort]}>
					<View style={styles.readyIcon}>
						<Feather name="image" size={24} color="#527F77" />
					</View>

					<View style={styles.readyContent}>
						<Text style={styles.readyTitle}>
							Foto pronta para imprimir
						</Text>

						<Text
							style={[
								styles.readyText,
								short && styles.readyTextShort,
							]}
						>
							A foto já foi processada para o quadro. O convidado
							não precisa ver o preview processado.
						</Text>
					</View>
				</View>

				<View
					style={[
						styles.resultInfoBox,
						short && styles.resultInfoBoxShort,
					]}
				>
					<Text style={styles.resultInfoText}>
						Resolução final: {processedPhoto.width} ×{" "}
						{processedPhoto.height}
					</Text>

					<Text style={styles.resultInfoText} numberOfLines={1}>
						Algoritmo: Good Display Floyd-Steinberg
					</Text>
				</View>

				<View style={styles.durationSection}>
					<Text style={styles.sectionTitle}>Duração</Text>

					<Text
						style={[
							styles.helperText,
							short && styles.helperTextShort,
						]}
					>
						A duração começa quando a foto for exibida no quadro.
					</Text>

					<View style={styles.durationOptions}>
						{DURATION_OPTIONS.map((option) => {
							const selected = durationMinutes === option.minutes;

							return (
								<Pressable
									key={option.minutes}
									style={({ pressed }) => [
										styles.durationOption,
										short && styles.durationOptionShort,
										selected &&
											styles.durationOptionSelected,
										pressed && styles.pressed,
									]}
									onPress={() => {
										setDurationMinutes(option.minutes);

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
				</View>

				<View style={styles.processedPreviewArea}>
					{previewUrl ? (
						<View
							style={[
								styles.processedPreviewFrame,
								{
									width: compact
										? Math.min(width * 0.5, 220)
										: Math.min(width * 0.7, 420),
									aspectRatio:
										processedPhoto.width /
										processedPhoto.height,
								},
							]}
						>
							<Image
								source={{ uri: previewUrl }}
								style={styles.processedPreviewImage}
								resizeMode="contain"
							/>
						</View>
					) : null}
				</View>

				<View style={styles.actions}>
					<Pressable
						disabled={isSending}
						style={({ pressed }) => [
							styles.primaryButton,
							pressed &&
								!isSending &&
								styles.primaryButtonPressed,
							isSending && styles.buttonDisabled,
						]}
						onPress={sendTemporaryPhoto}
					>
						{isSending ? (
							<ActivityIndicator color="#FFFFFF" />
						) : (
							<Text style={styles.primaryButtonText}>
								Agendar impressão
							</Text>
						)}
					</Pressable>

					{sendError && (
						<Text style={styles.sendError}>{sendError}</Text>
					)}

					<Pressable
						style={({ pressed }) => [
							styles.secondaryButton,
							pressed && styles.pressed,
						]}
						onPress={() => router.replace("/")}
						disabled={isSending}
					>
						<Text style={styles.secondaryButtonText}>Cancelar</Text>
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

	cardShort: {
		paddingTop: 10,
		paddingBottom: 8,
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

	descriptionShort: {
		marginBottom: 4,
	},

	descriptionStrong: {
		fontWeight: "700",
		color: "#1A1A1A",
	},

	deviceSummary: {
		minHeight: 62,

		borderWidth: 1,
		borderColor: "#DDDDDD",
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

	deviceSummaryShort: {
		minHeight: 58,
		paddingVertical: 6,
		marginBottom: 8,
	},

	summaryColumn: {
		flex: 1,
	},

	summaryDivider: {
		width: StyleSheet.hairlineWidth,
		height: "70%",

		backgroundColor: "#DDDDDD",

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

	readyBox: {
		flexDirection: "row",
		alignItems: "center",

		gap: 14,

		paddingHorizontal: 16,
		paddingVertical: 14,

		borderWidth: 1,
		borderColor: "#EEEEEE",
		borderRadius: 14,

		backgroundColor: "#FFFFFF",

		marginBottom: 12,

		shadowColor: "#000000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.04,
		shadowRadius: 8,

		elevation: 1,
	},

	readyBoxShort: {
		paddingVertical: 10,
		marginBottom: 8,
	},

	readyIcon: {
		width: 46,
		height: 46,

		flexShrink: 0,

		borderRadius: 23,

		backgroundColor: "#EDF2F1",

		alignItems: "center",
		justifyContent: "center",
	},

	processedPreviewArea: {
		flex: 1,
		minHeight: 0,

		alignItems: "center",
		justifyContent: "center",

		paddingVertical: 8,
	},

	processedPreviewFrame: {
		// maxHeight: 260,

		borderWidth: 1,
		borderColor: "#EEEEEE",
		borderRadius: 12,

		backgroundColor: "#F4F5F4",

		overflow: "hidden",
	},

	processedPreviewImage: {
		width: "100%",
		height: "100%",
	},

	readyContent: {
		flex: 1,
	},

	readyTitle: {
		fontSize: 17,
		lineHeight: 22,
		fontWeight: "700",

		color: "#1A1A1A",

		marginBottom: 3,
	},

	readyText: {
		fontSize: 14,
		lineHeight: 20,

		color: "#666666",
	},

	readyTextShort: {
		fontSize: 13,
		lineHeight: 18,
	},

	resultInfoBox: {
		gap: 2,
		marginBottom: 12,
		paddingHorizontal: 2,
	},

	resultInfoBoxShort: {
		marginBottom: 8,
	},

	resultInfoText: {
		fontSize: 13,
		lineHeight: 18,

		color: "#666666",
	},

	durationSection: {
		flexShrink: 0,
	},

	sectionTitle: {
		fontSize: 20,
		lineHeight: 25,
		fontWeight: "700",

		color: "#1A1A1A",
	},

	helperText: {
		marginTop: 2,
		marginBottom: 10,

		fontSize: 14,
		lineHeight: 19,

		color: "#666666",
	},

	helperTextShort: {
		marginBottom: 6,
	},

	durationOptions: {
		flexDirection: "row",
		flexWrap: "wrap",

		gap: 8,
	},

	durationOption: {
		width: "48%",
		flexGrow: 1,

		minHeight: 44,

		borderWidth: 1,
		borderColor: "#DDDDDD",
		borderRadius: 12,

		backgroundColor: "#FFFFFF",

		alignItems: "center",
		justifyContent: "center",

		paddingHorizontal: 12,
	},

	durationOptionShort: {
		minHeight: 40,
	},

	durationOptionSelected: {
		borderColor: "#668882",
		backgroundColor: "#EDF2F1",
	},

	durationOptionText: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: "600",

		color: "#1A1A1A",
	},

	durationOptionTextSelected: {
		color: "#4e6863",
	},

	actions: {
		flexShrink: 0,
		paddingTop: 8,
	},

	primaryButton: {
		minHeight: 48,

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

	buttonDisabled: {
		opacity: 0.5,
	},

	secondaryButton: {
		minHeight: 48,

		marginTop: 8,

		paddingHorizontal: 16,
		paddingVertical: 12,

		borderWidth: 1,
		borderColor: "#DDDDDD",
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

	sendError: {
		marginTop: 6,

		fontSize: 13,
		lineHeight: 18,

		color: "#B42318",
		textAlign: "center",
	},

	pressed: {
		opacity: 0.72,
	},
});
