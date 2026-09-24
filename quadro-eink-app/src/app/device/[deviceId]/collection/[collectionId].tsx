import { useCallback, useState } from "react";

import {
	ActivityIndicator,
	Pressable,
	ScrollView,
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
					console.error(error);
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
				<ActivityIndicator />
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
				<ScrollView contentContainerStyle={styles.content}>
					{photos.length === 0 ? (
						<Text style={styles.emptyText}>
							Nenhuma foto nesta coleção.
						</Text>
					) : (
						<View style={styles.photoList}>
							{photos.map((photo) => (
								<View
									key={photo.id}
									style={styles.photoPlaceholder}
								>
									<Text>{photo.id}</Text>
								</View>
							))}
						</View>
					)}
				</ScrollView>

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

	content: {
		padding: 24,
		flexGrow: 1,
	},

	emptyText: {
		color: "#777777",
		textAlign: "center",
		marginTop: 40,
	},

	photoList: {
		gap: 12,
	},

	photoPlaceholder: {
		borderWidth: 1,
		borderColor: "#dddddd",
		borderRadius: 12,
		padding: 20,
	},

	addButton: {
		margin: 24,
		marginTop: 0,
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
