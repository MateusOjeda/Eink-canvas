import { useCallback, useState } from "react";

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

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { deleteTemporaryPhoto, getTemporaryPhotos } from "@/firebase/photos";

import { getDevice } from "@/firebase/devices";

import { getCachedStorageFileUri } from "@/firebase/storage";

import type { TemporaryPhoto } from "@/types/photo";

import type { DisplayOrientation } from "@/types/display";

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
		day: "2-digit",
		month: "long",
	});
}

function getPhotoOrientation(photo: TemporaryPhoto): DisplayOrientation {
	return photo.width > photo.height ? "landscape" : "portrait";
}

export default function TemporaryPhotosScreen() {
	const { deviceId } = useLocalSearchParams<{
		deviceId: string;
	}>();

	const [photos, setPhotos] = useState<TemporaryPhotoWithPreview[]>([]);

	const [deviceOrientation, setDeviceOrientation] =
		useState<DisplayOrientation | null>(null);

	const [loading, setLoading] = useState(true);

	const [deletingId, setDeletingId] = useState<string | null>(null);

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
		} finally {
			setLoading(false);
		}
	}, [deviceId]);

	/*
	 * Recarrega sempre que voltamos para
	 * esta tela.
	 *
	 * Assim, depois de adicionar uma foto,
	 * ela aparece automaticamente.
	 */
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
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	return (
		<>
			<View style={styles.container}>
				<ScrollView
					contentContainerStyle={styles.content}
					showsVerticalScrollIndicator={false}
				>
					{photos.length === 0 ? (
						<View style={styles.emptyContainer}>
							<Text style={styles.emptyTitle}>
								Nenhuma foto agendada
							</Text>

							<Text style={styles.emptyText}>
								As fotos agendadas e recorrências anuais deste
								quadro aparecerão aqui.
							</Text>
						</View>
					) : (
						photos.map((photo) => {
							const orientationIncompatible =
								deviceOrientation !== null &&
								getPhotoOrientation(photo) !== deviceOrientation;

							return (
								<View key={photo.id} style={styles.photoCard}>
									<View style={styles.previewContainer}>
										<Image
											source={{
												uri: photo.previewUri,
											}}
											style={styles.preview}
											resizeMode="contain"
										/>

										{orientationIncompatible && (
											<View style={styles.orientationWarning}>
												<Text style={styles.orientationWarningText}>
													Orientação incompatível
												</Text>
											</View>
										)}
									</View>

									<View style={styles.photoFooter}>
									<View style={styles.expirationContainer}>
										{photo.recurrence === "once" ? (
											<>
												<Text style={styles.expirationLabel}>
													Duração
												</Text>

												<Text style={styles.expirationValue}>
													{formatDuration(
														photo.durationMinutes,
													)}
												</Text>
											</>
										) : (
											<>
												<Text style={styles.expirationLabel}>
													Todo ano
												</Text>

												<Text style={styles.expirationValue}>
													{formatYearlyDate(
														photo.yearlyDate,
													)}
												</Text>
											</>
										)}
									</View>

									<Pressable
										style={[
											styles.deleteButton,

											deletingId === photo.id &&
												styles.deleteButtonDisabled,
										]}
										disabled={deletingId === photo.id}
										onPress={() => handleDelete(photo)}
									>
										{deletingId === photo.id ? (
											<ActivityIndicator size="small" />
										) : (
											<Text
												style={styles.deleteButtonText}
											>
												Excluir
											</Text>
										)}
									</Pressable>
								</View>
								</View>
							);
						})
					)}

					<Pressable style={styles.addButton} onPress={handleAdd}>
						<Text style={styles.addButtonText}>+ Adicionar</Text>
					</Pressable>
				</ScrollView>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,

		backgroundColor: "#ffffff",
	},

	loadingContainer: {
		flex: 1,

		alignItems: "center",
		justifyContent: "center",

		backgroundColor: "#ffffff",
	},

	content: {
		padding: 16,
		paddingBottom: 32,
	},

	emptyContainer: {
		paddingVertical: 60,

		alignItems: "center",
	},

	emptyTitle: {
		fontSize: 18,
		fontWeight: "600",

		color: "#222222",
	},

	emptyText: {
		marginTop: 8,

		maxWidth: 280,

		fontSize: 14,
		lineHeight: 20,

		color: "#777777",

		textAlign: "center",
	},

	photoCard: {
		marginBottom: 18,

		borderWidth: 1,
		borderColor: "#eeeeee",

		borderRadius: 14,

		overflow: "hidden",

		backgroundColor: "#ffffff",
	},

	previewContainer: {
		position: "relative",
	},

	preview: {
		width: "100%",
		aspectRatio: 4 / 3,

		backgroundColor: "#f5f5f5",
	},

	orientationWarning: {
		position: "absolute",

		left: 12,
		right: 12,
		bottom: 12,

		paddingHorizontal: 12,
		paddingVertical: 9,

		borderRadius: 10,

		backgroundColor: "rgba(255, 255, 255, 0.94)",

		borderWidth: 1,
		borderColor: "#dddddd",

		alignItems: "center",
	},

	orientationWarningText: {
		fontSize: 13,
		fontWeight: "600",

		color: "#555555",
	},

	photoFooter: {
		flexDirection: "row",

		alignItems: "center",
		justifyContent: "space-between",

		padding: 14,

		gap: 12,
	},

	expirationContainer: {
		flex: 1,
	},

	expirationLabel: {
		fontSize: 12,

		color: "#888888",
	},

	expirationValue: {
		marginTop: 3,

		fontSize: 14,
		fontWeight: "600",

		color: "#222222",
	},

	deleteButton: {
		borderWidth: 1,
		borderColor: "#dddddd",

		borderRadius: 10,

		paddingHorizontal: 14,
		paddingVertical: 10,

		minWidth: 72,

		alignItems: "center",
		justifyContent: "center",
	},

	deleteButtonDisabled: {
		opacity: 0.5,
	},

	deleteButtonText: {
		fontSize: 14,
		fontWeight: "600",

		color: "#b42318",
	},

	addButton: {
		marginTop: 4,

		backgroundColor: "#111111",

		borderRadius: 12,

		paddingVertical: 15,

		alignItems: "center",
		justifyContent: "center",
	},

	addButtonText: {
		fontSize: 16,
		fontWeight: "600",

		color: "#ffffff",
	},
});
