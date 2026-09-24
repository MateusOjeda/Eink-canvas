import { useEffect, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

import { router, Stack, useLocalSearchParams } from "expo-router";

import { getPhoto, updatePhotoDescription } from "@/firebase/photos";

import { MAX_PHOTO_DESCRIPTION_LENGTH } from "@/constants/constants";

export default function PhotoDescriptionScreen() {
	const { deviceId, collectionId, photoId } = useLocalSearchParams<{
		deviceId: string;
		collectionId: string;
		photoId: string;
	}>();

	const [description, setDescription] = useState("");

	const [loading, setLoading] = useState(true);

	const [saving, setSaving] = useState(false);

	useEffect(() => {
		const loadPhoto = async () => {
			try {
				const photo = await getPhoto(deviceId, collectionId, photoId);

				if (!photo) {
					Alert.alert("Foto não encontrada");

					router.back();
					return;
				}

				setDescription(photo.description ?? "");
			} catch (error) {
				console.error("Erro ao carregar descrição:", error);

				Alert.alert("Erro", "Não foi possível carregar a descrição.");
			} finally {
				setLoading(false);
			}
		};

		loadPhoto();
	}, [deviceId, collectionId, photoId]);

	const save = async () => {
		try {
			setSaving(true);

			await updatePhotoDescription(
				deviceId,
				collectionId,
				photoId,
				description,
			);

			router.back();
		} catch (error) {
			console.error("Erro ao salvar descrição:", error);

			Alert.alert("Erro", "Não foi possível salvar a descrição.");
		} finally {
			setSaving(false);
		}
	};

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
					title: "Descrição",
				}}
			/>

			<View style={styles.container}>
				<Text style={styles.label}>Descrição da foto</Text>

				<TextInput
					value={description}
					onChangeText={setDescription}
					maxLength={MAX_PHOTO_DESCRIPTION_LENGTH}
					multiline
					autoFocus
					textAlignVertical="top"
					placeholder="Quem está na foto? O que aconteceu? O que você quer lembrar?"
					style={styles.input}
				/>

				<Text style={styles.counter}>
					{description.length} / {MAX_PHOTO_DESCRIPTION_LENGTH}
				</Text>

				<Pressable
					disabled={saving}
					style={[
						styles.saveButton,

						saving && styles.saveButtonDisabled,
					]}
					onPress={save}
				>
					<Text style={styles.saveButtonText}>
						{saving ? "Salvando..." : "Salvar"}
					</Text>
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
		alignItems: "center",
		justifyContent: "center",
	},

	label: {
		fontSize: 15,
		fontWeight: "600",
		marginBottom: 8,
	},

	input: {
		minHeight: 180,

		borderWidth: 1,
		borderColor: "#cccccc",
		borderRadius: 12,

		padding: 14,

		fontSize: 16,
		lineHeight: 22,

		backgroundColor: "#ffffff",
	},

	counter: {
		marginTop: 8,
		textAlign: "right",
		fontSize: 13,
		color: "#777777",
	},

	saveButton: {
		marginTop: 24,

		backgroundColor: "#111111",

		borderRadius: 12,

		paddingVertical: 16,

		alignItems: "center",
	},

	saveButtonDisabled: {
		opacity: 0.5,
	},

	saveButtonText: {
		color: "#ffffff",

		fontSize: 16,
		fontWeight: "600",
	},
});
