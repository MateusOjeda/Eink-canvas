import { useCallback, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Image,
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

import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, spacing, typography } from "@/theme";

import { deleteTemporaryPhoto, getTemporaryPhotos } from "@/firebase/photos";

import { getDevice } from "@/firebase/devices";
import { getCachedStorageFileUri } from "@/firebase/storage";

import type { TemporaryPhoto } from "@/types/photo";
import type { DisplayOrientation } from "@/types/display";

import { useDeviceProcessing } from "@/contexts/DeviceProcessingContext";

type TemporaryPhotoWithPreview = TemporaryPhoto & {
	previewUri: string;
};

function formatDuration(minutes: number) {
	const days = Math.floor(minutes / (24 * 60));
	const remainingMinutes = minutes % (24 * 60);
	const hours = Math.floor(remainingMinutes / 60);
	const mins = remainingMinutes % 60;

	const parts: string[] = [];

	if (days > 0) {
		parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
	}

	if (hours > 0) {
		parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
	}

	if (mins > 0) {
		parts.push(`${mins} min`);
	}

	return parts.join(" e ");
}

function formatYearlyDate(date: { month: number; day: number }) {
	const value = new Date(2024, date.month - 1, date.day);

	return value.toLocaleDateString("pt-BR", {
		day: "numeric",
		month: "long",
	});
}

function formatConsumedAt(value: unknown) {
	let date: Date | null = null;

	if (value instanceof Date) {
		date = value;
	} else if (
		typeof value === "object" &&
		value !== null &&
		"toDate" in value &&
		typeof value.toDate === "function"
	) {
		date = value.toDate();
	} else if (typeof value === "string" || typeof value === "number") {
		const parsed = new Date(value);

		if (!Number.isNaN(parsed.getTime())) {
			date = parsed;
		}
	}

	if (!date) {
		return null;
	}

	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

function getPhotoOrientation(photo: TemporaryPhoto): DisplayOrientation {
	return photo.width > photo.height ? "landscape" : "portrait";
}

export default function TemporaryPhotosScreen() {
	const { deviceId } = useLocalSearchParams<{
		deviceId: string;
	}>();

	const [photos, setPhotos] = useState<TemporaryPhotoWithPreview[]>([]);

	const [deviceName, setDeviceName] = useState("");
	const [deviceOrientation, setDeviceOrientation] =
		useState<DisplayOrientation | null>(null);

	const [loading, setLoading] = useState(true);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const deviceProcessing = useDeviceProcessing();

	const loadPhotos = useCallback(async () => {
		if (!deviceId) {
			return;
		}

		try {
			setLoading(true);

			const [temporaryPhotos, device] = await Promise.all([
				getTemporaryPhotos(deviceId),
				getDevice(deviceId),
			]);

			setDeviceName(device?.name ?? "");
			setDeviceOrientation(device?.orientation ?? null);

			const photosWithPreview = await Promise.all(
				temporaryPhotos.map(async (photo) => ({
					...photo,
					previewUri: await getCachedStorageFileUri(
						photo.previewPath,
					),
				})),
			);

			setPhotos(photosWithPreview);
		} catch (error) {
			console.error("Erro ao carregar fotos agendadas:", error);

			Alert.alert(
				"Erro",
				"Não foi possível carregar as fotos agendadas.",
			);
		} finally {
			setLoading(false);
		}
	}, [deviceId]);

	useFocusEffect(
		useCallback(() => {
			loadPhotos();
		}, [loadPhotos]),
	);

	const handleDelete = (photo: TemporaryPhotoWithPreview) => {
		Alert.alert(
			"Excluir foto",
			"Tem certeza que deseja excluir esta foto?",
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
							setDeletingId(photo.id);

							await deleteTemporaryPhoto(deviceId, photo);

							setPhotos((current) =>
								current.filter((item) => item.id !== photo.id),
							);
						} catch (error) {
							console.error(
								"Erro ao excluir foto agendada:",
								error,
							);

							Alert.alert(
								"Erro",
								"Não foi possível excluir a foto.",
							);
						} finally {
							setDeletingId(null);
						}
					},
				},
			],
		);
	};

	const handleAdd = () => {
		router.push({
			pathname: "/device/[deviceId]/temporary-photo",
			params: {
				deviceId,
			},
		});
	};

	if (loading) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />

				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color={colors.primary} />
				</View>
			</>
		);
	}

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<Screen scroll refreshing={loading} onRefresh={loadPhotos}>
				<ScreenHeader
					title="Fotos agendadas"
					subtitle={deviceName}
					showBackButton
					processing={deviceProcessing}
				/>

				<PrimaryButton
					title="Adicionar foto agendada"
					onPress={handleAdd}
					style={styles.addButton}
					leftIcon={
						<Ionicons name="add" size={28} color={colors.white} />
					}
				/>

				{photos.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Text style={styles.emptyTitle}>
							Nenhuma foto agendada
						</Text>

						<Text style={styles.emptyText}>
							As fotos por duração e recorrências anuais deste
							quadro aparecerão aqui.
						</Text>
					</View>
				) : (
					<View style={styles.photoList}>
						{photos.map((photo) => {
							const orientationIncompatible =
								deviceOrientation !== null &&
								getPhotoOrientation(photo) !==
									deviceOrientation;

							const isConsumed =
								photo.recurrence === "once" &&
								photo.consumedAt != null;

							const consumedAt = isConsumed
								? formatConsumedAt(photo.consumedAt)
								: null;

							const isDeleting = deletingId === photo.id;

							return (
								<Card
									key={photo.id}
									style={styles.photoCard}
									padding="sm"
								>
									<View style={styles.previewContainer}>
										<Image
											source={{
												uri: photo.previewUri,
											}}
											style={styles.preview}
											resizeMode="cover"
										/>

										{orientationIncompatible ? (
											<View
												style={
													styles.orientationMismatchOverlay
												}
											>
												<View
													style={
														styles.orientationMismatchLabel
													}
												>
													<Text
														style={
															styles.orientationMismatchText
														}
														numberOfLines={1}
													>
														Orientação
													</Text>

													<Text
														style={
															styles.orientationMismatchText
														}
														numberOfLines={1}
													>
														incompatível
													</Text>
												</View>
											</View>
										) : null}

										{isConsumed ? (
											<View
												style={styles.consumedOverlay}
											>
												<View
													style={styles.consumedLabel}
												>
													<Ionicons
														name="checkmark-circle"
														size={24}
														color={colors.white}
													/>

													<Text
														style={
															styles.consumedText
														}
													>
														Já exibida
													</Text>
												</View>
											</View>
										) : null}
									</View>

									<View style={styles.photoInfo}>
										<View style={styles.typeRow}>
											{photo.recurrence === "once" ? (
												<Feather
													name="clock"
													size={19}
													color={colors.textSecondary}
												/>
											) : (
												<MaterialCommunityIcons
													name="calendar-month-outline"
													size={20}
													color={colors.textSecondary}
												/>
											)}

											<Text style={styles.typeLabel}>
												{photo.recurrence === "once"
													? "Por duração"
													: "Todo ano"}
											</Text>
										</View>

										<Text style={styles.scheduleValue}>
											{photo.recurrence === "once"
												? formatDuration(
														photo.durationMinutes,
													)
												: formatYearlyDate(
														photo.yearlyDate,
													)}
										</Text>

										<Text
											style={styles.scheduleDescription}
										>
											{photo.recurrence === "once"
												? isConsumed
													? consumedAt
														? `Exibida em ${consumedAt}`
														: "Já exibida"
													: "Aparece na próxima sincronização"
												: photo.consumedAt
													? formatConsumedAt(
															photo.consumedAt,
														)
														? `Exibida em ${formatConsumedAt(photo.consumedAt)}`
														: "Exibição anual"
													: "Exibição anual"}
										</Text>

										{photo.createdByEmail ? (
											<Text style={styles.senderText}>
												Enviada por: {"\n"}
												{photo.createdByEmail}
											</Text>
										) : null}
									</View>

									<IconButton
										accessibilityLabel="Excluir foto"
										disabled={isDeleting}
										style={styles.deleteButton}
										onPress={() => handleDelete(photo)}
										icon={
											isDeleting ? (
												<ActivityIndicator
													size="small"
													color={colors.textSecondary}
												/>
											) : (
												<Ionicons
													name="trash-outline"
													size={21}
													color={colors.textSecondary}
												/>
											)
										}
									/>
								</Card>
							);
						})}
					</View>
				)}
			</Screen>
		</>
	);
}

const styles = StyleSheet.create({
	loadingContainer: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.background,
	},

	addButton: {
		marginBottom: spacing.xxl,
	},

	emptyContainer: {
		paddingVertical: 60,
		alignItems: "center",
	},

	emptyTitle: {
		...typography.emptyTitle,
		color: colors.text,
	},

	emptyText: {
		marginTop: spacing.sm,
		maxWidth: 280,
		...typography.body,
		color: colors.textSecondary,
		textAlign: "center",
	},

	photoList: {
		gap: spacing.lg,
	},

	photoCard: {
		minHeight: 146,
		flexDirection: "row",
		alignItems: "stretch",
		gap: spacing.md,
	},

	previewContainer: {
		position: "relative",

		width: 92,
		height: 122,

		flexShrink: 0,

		borderRadius: radius.md,
		overflow: "hidden",
	},

	preview: {
		width: 92,
		height: 122,
		borderRadius: radius.md,
		backgroundColor: colors.surfaceMuted,
	},

	orientationMismatchOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,

		padding: spacing.sm,

		borderRadius: radius.md,

		backgroundColor: "rgba(70, 70, 70, 0.42)",

		alignItems: "center",
		justifyContent: "center",
	},

	orientationMismatchLabel: {
		width: "100%",
		alignItems: "center",
	},

	orientationMismatchText: {
		...typography.caption,
		fontWeight: "600",
		color: colors.white,
		textAlign: "center",

		fontSize: 11,
		lineHeight: 14,
	},

	consumedOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,

		padding: spacing.sm,

		borderRadius: radius.md,

		backgroundColor: "rgba(70, 70, 70, 0.52)",

		alignItems: "center",
		justifyContent: "center",
	},

	consumedLabel: {
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.xs,
	},

	consumedText: {
		...typography.caption,
		fontWeight: "600",
		color: colors.white,
		textAlign: "center",

		fontSize: 11,
		lineHeight: 14,
	},

	photoInfo: {
		flex: 1,
		minWidth: 0,
		paddingVertical: spacing.xs,
		paddingRight: 34,
	},

	typeRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},

	typeLabel: {
		...typography.body,
		color: colors.textSecondary,
	},

	scheduleValue: {
		marginTop: spacing.sm,
		fontSize: 20,
		lineHeight: 25,
		fontWeight: "700",
		color: colors.text,
	},

	scheduleDescription: {
		marginTop: spacing.xs,
		...typography.caption,
		color: colors.textSecondary,
	},

	deleteButton: {
		position: "absolute",
		top: spacing.md,
		right: spacing.md,
		width: 40,
		height: 40,
		borderRadius: radius.md,
	},

	senderText: {
		marginTop: spacing.xs,
		...typography.caption,
		color: colors.textMuted,
	},
});
