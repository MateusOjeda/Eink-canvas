import { useCallback, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Pressable,
	StyleSheet,
	Switch,
	Text,
	View,
} from "react-native";

import {
	router,
	Stack,
	useFocusEffect,
	useLocalSearchParams,
} from "expo-router";

import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { getDevice } from "@/firebase/devices";

import { getCollections, setCollectionActive } from "@/firebase/collections";

import { deleteCollectionWithPhotos } from "@/firebase/cascade";

import type { Device } from "@/types/device";

import type { PhotoCollection } from "@/types/photo-collection";

export default function DeviceScreen() {
	const { deviceId } = useLocalSearchParams<{
		deviceId: string;
	}>();

	const [device, setDevice] = useState<Device | null>(null);

	const [collections, setCollections] = useState<PhotoCollection[]>([]);

	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		try {
			const [loadedDevice, loadedCollections] = await Promise.all([
				getDevice(deviceId),
				getCollections(deviceId),
			]);

			setDevice(loadedDevice);

			setCollections(loadedCollections);
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

	const handleToggleCollection = async (
		photoCollection: PhotoCollection,
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

	const handleDeleteCollection = (photoCollection: PhotoCollection) => {
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
			<View style={styles.loading}>
				<ActivityIndicator />
			</View>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: device ? `${device.name}` : "",
					headerRight: () => (
						<Pressable
							hitSlop={12}
							onPress={() =>
								router.push({
									pathname:
										"/device/[deviceId]/temporary-photos",

									params: {
										deviceId,
									},
								})
							}
						>
							<MaterialCommunityIcons
								name="image-refresh-outline"
								size={25}
								color="#666666"
							/>
						</Pressable>
					),
				}}
			/>

			<View style={styles.container}>
				<View style={styles.list}>
					{collections.map((photoCollection) => (
						<View
							key={photoCollection.id}
							style={styles.collectionCard}
						>
							<Pressable
								style={styles.collectionInfo}
								onPress={() =>
									router.push({
										pathname:
											"/device/[deviceId]/collection/[collectionId]",

										params: {
											deviceId,

											collectionId: photoCollection.id,
										},
									})
								}
							>
								<Text style={styles.collectionName}>
									{photoCollection.name}
								</Text>

								<Text style={styles.collectionStatus}>
									{photoCollection.active
										? "Ativa"
										: "Desativada"}
								</Text>
							</Pressable>

							<View style={styles.collectionActions}>
								<Switch
									value={photoCollection.active}
									onValueChange={(active) =>
										handleToggleCollection(
											photoCollection,
											active,
										)
									}
								/>

								<Pressable
									hitSlop={10}
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
								>
									<Feather
										name="edit"
										size={20}
										color="#666666"
									/>
								</Pressable>

								<Pressable
									hitSlop={10}
									onPress={() =>
										handleDeleteCollection(photoCollection)
									}
								>
									<Ionicons
										name="trash-outline"
										size={20}
										color="#666666"
									/>
								</Pressable>
							</View>
						</View>
					))}
				</View>

				<Pressable
					style={styles.addButton}
					onPress={() =>
						router.push({
							pathname: "/edit-collection",

							params: {
								deviceId,
							},
						})
					}
				>
					<Text style={styles.addButtonText}>Adicionar coleção</Text>
				</Pressable>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#ffffff",
		padding: 24,
	},

	loading: {
		flex: 1,
		backgroundColor: "#ffffff",
		justifyContent: "center",
		alignItems: "center",
	},

	title: {
		fontSize: 24,
		fontWeight: "700",
		marginBottom: 20,
	},

	list: {
		gap: 12,
	},

	collectionCard: {
		borderWidth: 1,
		borderColor: "#dddddd",
		borderRadius: 12,
		padding: 16,

		flexDirection: "row",
		alignItems: "center",
	},

	collectionInfo: {
		flex: 1,
	},

	collectionName: {
		fontSize: 17,
		fontWeight: "600",
	},

	collectionStatus: {
		marginTop: 4,
		fontSize: 13,
		color: "#666666",
	},

	collectionActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 15,
	},

	addButton: {
		marginTop: 20,
		backgroundColor: "#6b6b6b",
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: "center",
	},

	addButtonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
});
