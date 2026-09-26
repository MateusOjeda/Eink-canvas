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

import {
	router,
	useFocusEffect,
	useLocalSearchParams,
	Stack,
} from "expo-router";

import { deleteTemporaryPhoto, getTemporaryPhotos } from "@/firebase/photos";

import { getCachedStorageFileUri } from "@/firebase/storage";

import type { TemporaryPhoto } from "@/types/photo";

type TemporaryPhotoWithPreview = TemporaryPhoto & {
	previewUri: string;
};

function formatExpiration(date: Date) {
	return date.toLocaleString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export default function TemporaryPhotosScreen() {
	const { deviceId } = useLocalSearchParams<{
		deviceId: string;
	}>();

	const [photos, setPhotos] = useState<TemporaryPhotoWithPreview[]>([]);

	const [loading, setLoading] = useState(true);

	const [deletingId, setDeletingId] = useState<string | null>(null);

	const loadPhotos = useCallback(async () => {
		if (!deviceId) {
			return;
		}

		try {
			setLoading(true);

			const temporaryPhotos = await getTemporaryPhotos(deviceId);

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
			console.error("Erro ao carregar fotos temporárias:", error);
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
			"Tem certeza que deseja excluir esta foto temporária?",
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
								"Erro ao excluir foto temporária:",
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
								Nenhuma foto temporária
							</Text>

							<Text style={styles.emptyText}>
								As fotos enviadas temporariamente para este
								quadro aparecerão aqui.
							</Text>
						</View>
					) : (
						photos.map((photo) => (
							<View key={photo.id} style={styles.photoCard}>
								<Image
									source={{
										uri: photo.previewUri,
									}}
									style={styles.preview}
									resizeMode="contain"
								/>

								<View style={styles.photoFooter}>
									<View style={styles.expirationContainer}>
										<Text style={styles.expirationLabel}>
											Expira em
										</Text>

										<Text style={styles.expirationValue}>
											{formatExpiration(photo.expiresAt)}
										</Text>
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
						))
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

	preview: {
		width: "100%",
		aspectRatio: 4 / 3,

		backgroundColor: "#f5f5f5",
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
