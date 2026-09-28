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

import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, spacing, typography } from "@/theme";

import { getPhotoCollection } from "@/firebase/collections";
import { getPhotos } from "@/firebase/photos";
import { getCachedStorageFileUri } from "@/firebase/storage";
import { getDevice } from "@/firebase/devices";

import type { PhotoCollection } from "@/types/photo-collection";
import type { Photo } from "@/types/photo";
import type { Device } from "@/types/device";

type PhotoWithThumbnail = {
	photo: Photo;
	thumbnailUri: string;
};

function getPhotoCountLabel(count: number) {
	return `${count} ${count === 1 ? "foto" : "fotos"}`;
}

export default function CollectionScreen() {
	const { deviceId, collectionId } = useLocalSearchParams<{
		deviceId: string;
		collectionId: string;
	}>();

	const [device, setDevice] = useState<Device | null>(null);

	const [photoCollection, setPhotoCollection] =
		useState<PhotoCollection | null>(null);

	const [photos, setPhotos] = useState<PhotoWithThumbnail[]>([]);

	const [loading, setLoading] = useState(true);

	useFocusEffect(
		useCallback(() => {
			const load = async () => {
				try {
					setLoading(true);

					const [
						loadedDevice,
						loadedCollection,
						loadedPhotos,
					] = await Promise.all([
						getDevice(deviceId),
						getPhotoCollection(
							deviceId,
							collectionId,
						),
						getPhotos(deviceId, collectionId),
					]);

					const loadedPhotosWithThumbnails =
						await Promise.all(
							loadedPhotos.map(async (photo) => ({
								photo,
								thumbnailUri:
									await getCachedStorageFileUri(
										photo.thumbnailPath,
									),
							})),
						);

					setDevice(loadedDevice);
					setPhotoCollection(loadedCollection);
					setPhotos(loadedPhotosWithThumbnails);
				} catch (error) {
					console.error(
						"Erro ao carregar coleção:",
						error,
					);
				} finally {
					setLoading(false);
				}
			};

			load();
		}, [deviceId, collectionId]),
	);

	const handleAddPhoto = () => {
		router.push({
			pathname: "/add-photo",

			params: {
				deviceId,
				collectionId,
				mode: "collection",
			},
		});
	};

	const handleOpenPhoto = (photoId: string) => {
		router.push({
			pathname:
				"/device/[deviceId]/collection/[collectionId]/photo/[photoId]",

			params: {
				deviceId,
				collectionId,
				photoId,
			},
		});
	};

	if (loading) {
		return (
			<>
				<Stack.Screen
					options={{ headerShown: false }}
				/>

				<View style={styles.loading}>
					<ActivityIndicator
						size="large"
						color={colors.primary}
					/>
				</View>
			</>
		);
	}

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<Screen
				contentContainerStyle={
					styles.screenContent
				}
			>
				<ScreenHeader
					title={photoCollection?.name ?? "Coleção"}
					subtitle={
						device
							? `${device.name} · ${getPhotoCountLabel(
									photos.length,
								)}`
							: getPhotoCountLabel(
									photos.length,
								)
					}
					showBackButton
				/>

				<PrimaryButton
					title="Adicionar foto"
					onPress={handleAddPhoto}
					style={styles.addButton}
					leftIcon={
						<Ionicons
							name="add"
							size={28}
							color={colors.white}
						/>
					}
				/>

				<FlatList
					data={photos}
					keyExtractor={(item) => item.photo.id}
					numColumns={2}
					style={styles.photoList}
					contentContainerStyle={[
						styles.photoListContent,
						photos.length === 0 &&
							styles.emptyListContent,
					]}
					columnWrapperStyle={
						photos.length > 1
							? styles.photoRow
							: undefined
					}
					showsVerticalScrollIndicator={false}
					ListEmptyComponent={
						<View style={styles.emptyContainer}>
							<Text style={styles.emptyTitle}>
								Nenhuma foto nesta coleção
							</Text>

							<Text style={styles.emptyText}>
								Adicione a primeira foto para
								começar a preencher este quadro.
							</Text>
						</View>
					}
					renderItem={({ item }) => {
						const { photo, thumbnailUri } = item;

						const photoOrientation =
							photo.height > photo.width
								? "portrait"
								: "landscape";

						const orientationMismatch =
							device !== null &&
							photoOrientation !==
								device.orientation;

						return (
							<Pressable
								style={({ pressed }) => [
									styles.photoContainer,
									pressed &&
										styles.photoPressed,
								]}
								onPress={() =>
									handleOpenPhoto(
										photo.id,
									)
								}
							>
								<Image
									source={{
										uri: thumbnailUri,
									}}
									style={styles.thumbnail}
									resizeMode="cover"
								/>

								{!photo.active ? (
									<View
										style={
											styles.inactiveOverlay
										}
									>
										<Text
											style={
												styles.inactiveText
											}
										>
											Desativada
										</Text>
									</View>
								) : orientationMismatch ? (
									<View
										style={
											styles.inactiveOverlay
										}
									>
										<Text
											style={
												styles.inactiveText
											}
										>
											Orientação
											incompatível
										</Text>
									</View>
								) : null}
							</Pressable>
						);
					}}
				/>
			</Screen>
		</>
	);
}

const styles = StyleSheet.create({
	screenContent: {
		paddingBottom: 0,
	},

	loading: {
		flex: 1,
		backgroundColor: colors.background,
		alignItems: "center",
		justifyContent: "center",
	},

	addButton: {
		marginBottom: spacing.xl,
	},

	photoList: {
		flex: 1,
	},

	photoListContent: {
		paddingBottom: spacing.xxl,
	},

	photoRow: {
		gap: spacing.md,
	},

	photoContainer: {
		flex: 1,
		maxWidth: "48%",
		aspectRatio: 1,
		marginBottom: spacing.md,
		borderRadius: radius.lg,
		overflow: "hidden",
		backgroundColor: colors.surfaceMuted,
	},

	photoPressed: {
		opacity: 0.82,
	},

	thumbnail: {
		width: "100%",
		height: "100%",
	},

	emptyListContent: {
		flexGrow: 1,
	},

	emptyContainer: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 60,
	},

	emptyTitle: {
		...typography.emptyTitle,
		color: colors.text,
		textAlign: "center",
	},

	emptyText: {
		marginTop: spacing.sm,
		maxWidth: 280,
		...typography.body,
		color: colors.textSecondary,
		textAlign: "center",
	},

	inactiveOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		padding: spacing.sm,
		backgroundColor: "rgba(0, 0, 0, 0.45)",
		alignItems: "center",
		justifyContent: "center",
	},

	inactiveText: {
		...typography.caption,
		fontWeight: "600",
		color: colors.white,
		textAlign: "center",
	},
});
