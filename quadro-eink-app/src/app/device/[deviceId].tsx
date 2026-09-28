import { useCallback, useState } from "react";

import {
	ActivityIndicator,
	Alert,
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

import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { AppSwitch } from "@/components/ui/AppSwitch";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, spacing, typography } from "@/theme";

import { getDevice } from "@/firebase/devices";
import { getCollections, setCollectionActive } from "@/firebase/collections";
import { getPhotos } from "@/firebase/photos";
import { getCachedStorageFileUri } from "@/firebase/storage";
import { deleteCollectionWithPhotos } from "@/firebase/cascade";

import type { Device } from "@/types/device";
import type { PhotoCollection } from "@/types/photo-collection";

type CollectionListItem = PhotoCollection & {
	photoCount: number;
	thumbnailUri: string | null;
};

function getDisplayTypeLabel(displayType: Device["displayType"]) {
	return displayType === "spectra6-13.3"
		? 'Spectra 6 — 13,3"'
		: 'Spectra 6 — 7,3"';
}

function getPhotoCountLabel(count: number) {
	return count === 1 ? "1 foto" : `${count} fotos`;
}

export default function DeviceScreen() {
	const { deviceId } = useLocalSearchParams<{
		deviceId: string;
	}>();

	const [device, setDevice] = useState<Device | null>(null);
	const [collections, setCollections] = useState<CollectionListItem[]>([]);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		try {
			setLoading(true);

			const [loadedDevice, loadedCollections] = await Promise.all([
				getDevice(deviceId),
				getCollections(deviceId),
			]);

			const collectionsWithDetails = await Promise.all(
				loadedCollections.map(async (photoCollection) => {
					const photos = await getPhotos(
						deviceId,
						photoCollection.id,
					);

					const firstPhoto = photos[0];

					let thumbnailUri: string | null = null;

					if (firstPhoto?.thumbnailPath) {
						try {
							thumbnailUri = await getCachedStorageFileUri(
								firstPhoto.thumbnailPath,
							);
						} catch (error) {
							console.error(
								"Erro ao carregar miniatura da coleção:",
								error,
							);
						}
					}

					return {
						...photoCollection,
						photoCount: photos.length,
						thumbnailUri,
					};
				}),
			);

			setDevice(loadedDevice);
			setCollections(collectionsWithDetails);
		} catch (error) {
			console.error(error);
			Alert.alert("Erro", "Não foi possível carregar o quadro.");
		} finally {
			setLoading(false);
		}
	}, [deviceId]);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load]),
	);

	const handleOpenCollection = (collectionId: string) => {
		router.push({
			pathname: "/device/[deviceId]/collection/[collectionId]",
			params: {
				deviceId,
				collectionId,
			},
		});
	};

	const handleToggleCollection = async (
		photoCollection: CollectionListItem,
		active: boolean,
	) => {
		try {
			await setCollectionActive(deviceId, photoCollection.id, active);

			setCollections((current) =>
				current.map((item) =>
					item.id === photoCollection.id
						? {
								...item,
								active,
							}
						: item,
				),
			);
		} catch (error) {
			console.error(error);
			Alert.alert("Erro", "Não foi possível alterar a coleção.");
		}
	};

	const handleDeleteCollection = (photoCollection: CollectionListItem) => {
		Alert.alert("Excluir coleção", `Excluir "${photoCollection.name}"?`, [
			{
				text: "Cancelar",
				style: "cancel",
			},
			{
				text: "Excluir",
				style: "destructive",
				onPress: async () => {
					try {
						await deleteCollectionWithPhotos(
							deviceId,
							photoCollection.id,
						);

						setCollections((current) =>
							current.filter(
								(item) => item.id !== photoCollection.id,
							),
						);
					} catch (error) {
						console.error("Erro ao excluir coleção:", error);

						Alert.alert(
							"Erro",
							"Não foi possível excluir a coleção.",
						);
					}
				},
			},
		]);
	};

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

				<Screen>
					<ScreenHeader
						title="Quadro"
						subtitle="Não foi possível carregar este dispositivo."
						showBackButton
					/>
				</Screen>
			</>
		);
	}

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<Screen scroll>
				<ScreenHeader
					title={device.name}
					subtitle={`${getDisplayTypeLabel(
						device.displayType,
					)} · Intervalo: ${device.updateIntervalMinutes} min`}
					showBackButton
				/>

				<Pressable
					onPress={() =>
						router.push({
							pathname: "/device/[deviceId]/temporary-photos",
							params: {
								deviceId,
							},
						})
					}
					style={({ pressed }) => [pressed && styles.pressed]}
				>
					<Card style={styles.scheduledCard}>
						<View style={styles.scheduledIcon}>
							<MaterialCommunityIcons
								name="calendar-month-outline"
								size={27}
								color={colors.textSecondary}
							/>
						</View>

						<View style={styles.scheduledText}>
							<Text style={styles.navigationTitle}>
								Fotos agendadas
							</Text>

							<Text style={styles.navigationSubtitle}>
								Gerencie as fotos com data ou duração
							</Text>
						</View>
					</Card>
				</Pressable>

				<View style={styles.collectionsHeader}>
					<Text style={styles.sectionTitle}>Coleções</Text>

					<Text style={styles.sectionSubtitle}>
						Escolha quais coleções aparecem neste quadro.
					</Text>
				</View>

				<View style={styles.collectionList}>
					{collections.map((photoCollection) => (
						<Card
							key={photoCollection.id}
							style={styles.collectionCard}
							padding="sm"
						>
							<Pressable
								style={({ pressed }) => [
									styles.collectionMain,
									pressed && styles.pressed,
								]}
								onPress={() =>
									handleOpenCollection(photoCollection.id)
								}
							>
								{photoCollection.thumbnailUri ? (
									<Image
										source={{
											uri: photoCollection.thumbnailUri,
										}}
										style={styles.collectionThumbnail}
										resizeMode="cover"
									/>
								) : (
									<View style={styles.collectionPlaceholder}>
										<MaterialCommunityIcons
											name="image-outline"
											size={24}
											color={colors.textMuted}
										/>
									</View>
								)}

								<View style={styles.collectionText}>
									<Text
										numberOfLines={1}
										style={styles.collectionName}
									>
										{photoCollection.name}
									</Text>

									<Text style={styles.photoCount}>
										{getPhotoCountLabel(
											photoCollection.photoCount,
										)}
									</Text>
								</View>
							</Pressable>

							<View style={styles.collectionControls}>
								<AppSwitch
									value={photoCollection.active}
									onValueChange={(active) =>
										handleToggleCollection(
											photoCollection,
											active,
										)
									}
									style={styles.collectionSwitch}
								/>

								<View style={styles.actionDivider} />

								<IconButton
									accessibilityLabel={`Editar ${photoCollection.name}`}
									style={styles.smallIconButton}
									onPress={() =>
										router.push({
											pathname: "/edit-collection",
											params: {
												deviceId,
												collectionId:
													photoCollection.id,
											},
										})
									}
									icon={
										<MaterialCommunityIcons
											name="square-edit-outline"
											size={20}
											color={colors.textSecondary}
										/>
									}
								/>

								<IconButton
									accessibilityLabel={`Excluir ${photoCollection.name}`}
									style={styles.smallIconButton}
									onPress={() =>
										handleDeleteCollection(photoCollection)
									}
									icon={
										<Ionicons
											name="trash-outline"
											size={20}
											color={colors.textSecondary}
										/>
									}
								/>
							</View>
						</Card>
					))}
				</View>

				<PrimaryButton
					title="Adicionar coleção"
					style={styles.addButton}
					onPress={() =>
						router.push({
							pathname: "/edit-collection",
							params: {
								deviceId,
							},
						})
					}
					leftIcon={
						<Ionicons name="add" size={28} color={colors.white} />
					}
				/>
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

	pressed: {
		opacity: 0.72,
	},

	scheduledCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
	},

	scheduledIcon: {
		width: 44,
		height: 44,
		borderRadius: radius.md,
		backgroundColor: colors.surfaceMuted,
		alignItems: "center",
		justifyContent: "center",
	},

	scheduledText: {
		flex: 1,
		minWidth: 0,
	},

	navigationTitle: {
		...typography.cardTitle,
		color: colors.text,
	},

	navigationSubtitle: {
		marginTop: spacing.xs,
		...typography.metadata,
		color: colors.textSecondary,
	},

	collectionsHeader: {
		marginTop: spacing.xxl,
		marginBottom: spacing.lg,
	},

	sectionTitle: {
		...typography.sectionTitle,
		color: colors.text,
	},

	sectionSubtitle: {
		marginTop: spacing.xs,
		...typography.body,
		color: colors.textSecondary,
	},

	collectionList: {
		gap: spacing.md,
	},

	collectionCard: {
		minHeight: 92,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},

	collectionMain: {
		flex: 1,
		minWidth: 0,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
	},

	collectionThumbnail: {
		width: 64,
		height: 64,
		borderRadius: radius.md,
		backgroundColor: colors.surfaceMuted,
	},

	collectionPlaceholder: {
		width: 64,
		height: 64,
		borderRadius: radius.md,
		backgroundColor: colors.surfaceMuted,
		alignItems: "center",
		justifyContent: "center",
	},

	collectionText: {
		flex: 1,
		minWidth: 0,
	},

	collectionName: {
		...typography.cardTitle,
		color: colors.text,
	},

	photoCount: {
		marginTop: spacing.xs,
		...typography.metadata,
		color: colors.textSecondary,
	},

	collectionControls: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},

	collectionSwitch: {
		transform: [{ scaleX: 0.86 }, { scaleY: 0.86 }],
	},

	actionDivider: {
		width: 1,
		height: 34,
		marginHorizontal: 2,
		backgroundColor: colors.borderSoft,
	},

	smallIconButton: {
		width: 36,
		height: 36,
		borderRadius: radius.md,
	},

	addButton: {
		marginTop: spacing.xl,
	},
});
