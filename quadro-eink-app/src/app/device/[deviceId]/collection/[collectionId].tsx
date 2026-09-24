import { useCallback, useState } from "react";

import {
	ActivityIndicator,
	FlatList,
	Image,
	Pressable,
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

import { getPhotoCollection } from "@/firebase/collections";

import { getPhotos } from "@/firebase/photos";

import { getStorageFileUrl } from "@/firebase/storage";

import type { PhotoCollection } from "@/types/photo-collection";

import type { Photo } from "@/types/photo";

export default function CollectionScreen() {
	const { deviceId, collectionId } = useLocalSearchParams<{
		deviceId: string;
		collectionId: string;
	}>();

	const [photoCollection, setPhotoCollection] =
		useState<PhotoCollection | null>(null);

	const [photos, setPhotos] = useState<Photo[]>([]);

	const [loading, setLoading] = useState(true);

	useFocusEffect(
		useCallback(() => {
			const load = async () => {
				try {
					const [loadedCollection, loadedPhotos] = await Promise.all([
						getPhotoCollection(deviceId, collectionId),

						getPhotos(deviceId, collectionId),
					]);

					setPhotoCollection(loadedCollection);

					setPhotos(loadedPhotos);
				} catch (error) {
					console.error("Erro ao carregar coleção:", error);
				} finally {
					setLoading(false);
				}
			};

			load();
		}, [deviceId, collectionId]),
	);

	if (loading) {
		return (
			<View style={styles.loading}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: photoCollection?.name ?? "Coleção",
				}}
			/>

			<View style={styles.container}>
				<FlatList
					data={photos}
					keyExtractor={(photo) => photo.id}
					numColumns={3}
					contentContainerStyle={styles.photoList}
					columnWrapperStyle={
						photos.length > 1 ? styles.photoRow : undefined
					}
					ListEmptyComponent={
						<View style={styles.emptyContainer}>
							<Text style={styles.emptyText}>
								Nenhuma foto nesta coleção.
							</Text>
						</View>
					}
					renderItem={({ item: photo }) => {
						const thumbnailUrl = getStorageFileUrl(
							photo.thumbnailPath,
						);

						return (
							<Pressable
								style={styles.photoContainer}
								onPress={() =>
									router.push({
										pathname:
											"/device/[deviceId]/collection/[collectionId]/photo/[photoId]",

										params: {
											deviceId,
											collectionId,
											photoId: photo.id,
										},
									})
								}
							>
								<Image
									source={{
										uri: thumbnailUrl,
									}}
									style={styles.thumbnail}
									resizeMode="cover"
								/>

								{!photo.active && (
									<View style={styles.inactiveOverlay}>
										<Text style={styles.inactiveText}>
											Desativada
										</Text>
									</View>
								)}
							</Pressable>
						);
					}}
				/>

				<Pressable
					style={styles.addButton}
					onPress={() =>
						router.push({
							pathname: "/add-photo",

							params: {
								deviceId,
								collectionId,
							},
						})
					}
				>
					<Text style={styles.addButtonText}>Adicionar foto</Text>
				</Pressable>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#ffffff",
	},

	loading: {
		flex: 1,
		backgroundColor: "#ffffff",

		alignItems: "center",

		justifyContent: "center",
	},

	photoList: {
		padding: 12,
		flexGrow: 1,
	},

	photoRow: {
		gap: 8,
		marginBottom: 8,
	},

	photoContainer: {
		flex: 1,

		maxWidth: "33.333%",

		aspectRatio: 1,

		borderRadius: 8,

		overflow: "hidden",

		backgroundColor: "#eeeeee",
	},

	thumbnail: {
		width: "100%",
		height: "100%",
	},

	emptyContainer: {
		flex: 1,

		alignItems: "center",

		justifyContent: "center",

		paddingVertical: 60,
	},

	emptyText: {
		fontSize: 14,

		color: "#777777",

		textAlign: "center",
	},

	inactiveOverlay: {
		position: "absolute",

		top: 0,
		left: 0,
		right: 0,
		bottom: 0,

		backgroundColor: "rgba(0, 0, 0, 0.45)",

		alignItems: "center",

		justifyContent: "center",
	},

	inactiveText: {
		color: "#ffffff",

		fontSize: 12,

		fontWeight: "600",
	},

	addButton: {
		marginHorizontal: 24,

		marginTop: 8,

		marginBottom: 24,

		backgroundColor: "#111111",

		borderRadius: 12,

		paddingVertical: 16,

		alignItems: "center",
	},

	addButtonText: {
		color: "#ffffff",

		fontSize: 16,

		fontWeight: "600",
	},
});
