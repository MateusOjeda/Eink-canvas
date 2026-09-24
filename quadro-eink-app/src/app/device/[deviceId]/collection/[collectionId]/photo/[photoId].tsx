import { useEffect, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Image,
	Pressable,
	StyleSheet,
	Switch,
	Text,
	View,
} from "react-native";

import { router, Stack, useLocalSearchParams } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { deletePhoto, getPhoto, setPhotoActive } from "@/firebase/photos";

import { getStorageFileUrl } from "@/firebase/storage";

import type { Photo } from "@/types/photo";

export default function PhotoScreen() {
	const { deviceId, collectionId, photoId } = useLocalSearchParams<{
		deviceId: string;
		collectionId: string;
		photoId: string;
	}>();

	const [photo, setPhoto] = useState<Photo | null>(null);

	const [loading, setLoading] = useState(true);

	const [updatingActive, setUpdatingActive] = useState(false);

	useEffect(() => {
		const loadPhoto = async () => {
			try {
				const loadedPhoto = await getPhoto(
					deviceId,
					collectionId,
					photoId,
				);

				if (!loadedPhoto) {
					Alert.alert("Foto não encontrada");

					router.back();

					return;
				}

				setPhoto(loadedPhoto);
			} catch (error) {
				console.error("Erro ao carregar foto:", error);

				Alert.alert("Erro", "Não foi possível carregar a foto.");
			} finally {
				setLoading(false);
			}
		};

		loadPhoto();
	}, [deviceId, collectionId, photoId]);

	const handleActiveChange = async (active: boolean) => {
		if (!photo || updatingActive) {
			return;
		}

		try {
			setUpdatingActive(true);

			await setPhotoActive(deviceId, collectionId, photo.id, active);

			setPhoto({
				...photo,
				active,
			});
		} catch (error) {
			console.error("Erro ao alterar estado da foto:", error);

			Alert.alert("Erro", "Não foi possível alterar a foto.");
		} finally {
			setUpdatingActive(false);
		}
	};

	const handleDelete = () => {
		if (!photo) {
			return;
		}

		Alert.alert(
			"Excluir foto",
			"Esta foto será removida permanentemente.",
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
							await deletePhoto(deviceId, collectionId, photo);

							router.back();
						} catch (error) {
							console.error("Erro ao excluir foto:", error);

							Alert.alert(
								"Erro",
								"Não foi possível excluir a foto.",
							);
						}
					},
				},
			],
		);
	};

	if (loading) {
		return (
			<View style={styles.loading}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (!photo) {
		return null;
	}

	const previewUrl = getStorageFileUrl(photo.previewPath);

	return (
		<>
			<Stack.Screen
				options={{
					title: "Foto",

					headerRight: () => (
						<Pressable onPress={handleDelete} hitSlop={12}>
							<Ionicons
								name="trash-outline"
								size={21}
								color="#666666"
							/>
						</Pressable>
					),
				}}
			/>

			<View style={styles.container}>
				<View style={styles.previewContainer}>
					<Image
						source={{
							uri: previewUrl,
						}}
						style={styles.preview}
						resizeMode="contain"
					/>
				</View>

				<View style={styles.option}>
					<View>
						<Text style={styles.optionTitle}>Foto ativa</Text>

						<Text style={styles.optionDescription}>
							Fotos desativadas não serão mostradas pelo quadro.
						</Text>
					</View>

					<Switch
						value={photo.active}
						disabled={updatingActive}
						onValueChange={handleActiveChange}
					/>
				</View>
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

	previewContainer: {
		flex: 1,

		backgroundColor: "#f2f2f2",

		borderRadius: 12,

		overflow: "hidden",

		justifyContent: "center",

		alignItems: "center",
	},

	preview: {
		width: "100%",
		height: "100%",
	},

	option: {
		marginTop: 24,

		flexDirection: "row",

		alignItems: "center",

		justifyContent: "space-between",

		gap: 20,
	},

	optionTitle: {
		fontSize: 16,

		fontWeight: "600",
	},

	optionDescription: {
		marginTop: 4,

		maxWidth: 260,

		fontSize: 13,

		lineHeight: 18,

		color: "#666666",
	},
});
