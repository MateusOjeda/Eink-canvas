import { useCallback, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Image,
	StyleSheet,
	Text,
	View,
} from "react-native";

import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";

import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";

import { colors, radius, spacing, typography } from "@/theme";

import { getDevice, getDeviceState } from "@/firebase/devices";
import { getCollections } from "@/firebase/collections";
import { getPhotos, getTemporaryPhotos } from "@/firebase/photos";
import { getCachedStorageFileUri } from "@/firebase/storage";

import type { Device } from "@/types/device";
import type { Photo, TemporaryPhoto } from "@/types/photo";
import type { PhotoCollection } from "@/types/photo-collection";

import { useDeviceProcessing } from "@/contexts/DeviceProcessingContext";

type HistoryItem = {
	imageId: string;
	lastDisplayedAt: string;
	photo: Photo | null;
	temporaryPhoto: TemporaryPhoto | null;
	isTemporary: boolean;
	thumbnailUri: string | null;
	collectionName: string | null;
};

function formatDisplayedAt(value: string) {
	const date = new Date(value);
	const now = new Date();

	const isToday =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();

	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);

	const isYesterday =
		date.getFullYear() === yesterday.getFullYear() &&
		date.getMonth() === yesterday.getMonth() &&
		date.getDate() === yesterday.getDate();

	const time = new Intl.DateTimeFormat("pt-BR", {
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);

	if (isToday) {
		return `Hoje, ${time}`;
	}

	if (isYesterday) {
		return `Ontem, ${time}`;
	}

	const day = new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);

	return `${day}, ${time}`;
}

export default function HistoryScreen() {
	const { deviceId } = useLocalSearchParams<{
		deviceId: string;
	}>();

	const [device, setDevice] = useState<Device | null>(null);
	const [history, setHistory] = useState<HistoryItem[]>([]);
	const [loading, setLoading] = useState(true);

	const deviceProcessing = useDeviceProcessing();

	const load = useCallback(async () => {
		try {
			setLoading(true);

			const [loadedDevice, state, collections, temporaryPhotos] =
				await Promise.all([
					getDevice(deviceId),
					getDeviceState(deviceId),
					getCollections(deviceId),
					getTemporaryPhotos(deviceId),
				]);

			setDevice(loadedDevice);

			if (!state?.displayHistory?.length) {
				setHistory([]);
				return;
			}

			const photosById = new Map<string, Photo>();
			const collectionNameByPhotoId = new Map<string, string>();

			await Promise.all(
				collections.map(async (photoCollection: PhotoCollection) => {
					const photos = await getPhotos(
						deviceId,
						photoCollection.id,
					);

					for (const photo of photos) {
						photosById.set(photo.id, photo);
						collectionNameByPhotoId.set(
							photo.id,
							photoCollection.name,
						);
					}
				}),
			);

			const temporaryPhotosById = new Map(
				temporaryPhotos.map((photo) => [photo.id, photo]),
			);

			const historyItems = await Promise.all(
				state.displayHistory.map(async (entry) => {
					const photo = photosById.get(entry.imageId) ?? null;
					const collectionName =
						photo !== null
							? (collectionNameByPhotoId.get(photo.id) ?? null)
							: null;

					const temporaryPhoto =
						temporaryPhotosById.get(entry.imageId) ?? null;

					let thumbnailUri: string | null = null;

					const thumbnailPath =
						photo?.thumbnailPath ??
						temporaryPhoto?.previewPath ??
						null;

					if (thumbnailPath) {
						try {
							thumbnailUri =
								await getCachedStorageFileUri(thumbnailPath);
						} catch (error) {
							console.error(
								"Erro ao carregar miniatura do histórico:",
								error,
							);
						}
					}

					return {
						imageId: entry.imageId,
						lastDisplayedAt: entry.lastDisplayedAt,
						photo,
						temporaryPhoto,
						isTemporary: temporaryPhoto !== null,
						thumbnailUri,
						collectionName,
					};
				}),
			);

			setHistory(historyItems);
		} catch (error) {
			console.error(error);
			Alert.alert("Erro", "Não foi possível carregar o histórico.");
		} finally {
			setLoading(false);
		}
	}, [deviceId]);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load]),
	);

	if (loading) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />

				<View style={styles.loading}>
					<ActivityIndicator size="large" color={colors.primary} />
				</View>
			</>
		);
	}

	if (!device) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />

				<Screen refreshing={loading} onRefresh={load}>
					<ScreenHeader
						title="Histórico"
						subtitle="Não foi possível carregar este dispositivo."
						showBackButton
						processing={deviceProcessing}
					/>
				</Screen>
			</>
		);
	}

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<Screen scroll refreshing={loading} onRefresh={load}>
				<ScreenHeader
					title="Histórico"
					subtitle={device.name}
					showBackButton
					processing={deviceProcessing}
				/>

				{history.length === 0 ? (
					<View style={styles.empty}>
						<View style={styles.emptyIcon}>
							<MaterialCommunityIcons
								name="history"
								size={28}
								color={colors.textSecondary}
							/>
						</View>

						<Text style={styles.emptyTitle}>
							Nenhuma foto exibida ainda
						</Text>

						<Text style={styles.emptyText}>
							As fotos exibidas neste quadro aparecerão aqui.
						</Text>
					</View>
				) : (
					<View style={styles.historyList}>
						{history.map((item) => (
							<View
								key={`${item.imageId}-${item.lastDisplayedAt}`}
								style={styles.historyItem}
							>
								{item.thumbnailUri ? (
									<Image
										source={{
											uri: item.thumbnailUri,
										}}
										style={styles.thumbnail}
										resizeMode="cover"
									/>
								) : (
									<View style={styles.thumbnailPlaceholder}>
										<MaterialCommunityIcons
											name="image-outline"
											size={26}
											color={colors.textMuted}
										/>
									</View>
								)}

								<View style={styles.itemContent}>
									<Text
										style={styles.photoTitle}
										numberOfLines={2}
									>
										{item.isTemporary
											? item.temporaryPhoto
													?.recurrence === "yearly"
												? "Foto anual"
												: "Foto temporária"
											: item.photo?.description ||
												item.collectionName ||
												"Foto"}
									</Text>

									<Text style={styles.displayedAt}>
										{formatDisplayedAt(
											item.lastDisplayedAt,
										)}
									</Text>
								</View>
							</View>
						))}
					</View>
				)}
			</Screen>
		</>
	);
}

const styles = StyleSheet.create({
	loading: {
		flex: 1,
		backgroundColor: colors.background,
		alignItems: "center",
		justifyContent: "center",
	},

	empty: {
		alignItems: "center",
		paddingHorizontal: spacing.xl,
		paddingTop: spacing.xxl,
	},

	emptyIcon: {
		width: 52,
		height: 52,
		borderRadius: radius.md,
		backgroundColor: colors.surfaceMuted,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: spacing.md,
	},

	emptyTitle: {
		...typography.cardTitle,
		color: colors.text,
		textAlign: "center",
	},

	emptyText: {
		marginTop: spacing.xs,
		...typography.body,
		color: colors.textSecondary,
		textAlign: "center",
	},

	historyList: {
		gap: spacing.md,
		paddingTop: spacing.md,
	},

	historyItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
	},

	thumbnail: {
		width: 80,
		height: 80,
		borderRadius: radius.md,
		backgroundColor: colors.surfaceMuted,
	},

	thumbnailPlaceholder: {
		width: 80,
		height: 80,
		borderRadius: radius.md,
		backgroundColor: colors.surfaceMuted,
		alignItems: "center",
		justifyContent: "center",
	},

	itemContent: {
		flex: 1,
		minWidth: 0,
	},

	photoTitle: {
		...typography.cardTitle,
		color: colors.text,
	},

	displayedAt: {
		marginTop: spacing.xs,
		...typography.metadata,
		color: colors.textSecondary,
	},
});
