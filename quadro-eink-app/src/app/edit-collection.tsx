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

import {
	createPhotoCollection,
	getPhotoCollection,
	renamePhotoCollection,
} from "@/firebase/collections";

export default function EditCollectionScreen() {
	const { deviceId, collectionId } = useLocalSearchParams<{
		deviceId: string;
		collectionId?: string;
	}>();

	const [name, setName] = useState("");

	const [loading, setLoading] = useState(!!collectionId);

	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!collectionId) {
			return;
		}

		const loadCollection = async () => {
			try {
				const photoCollection = await getPhotoCollection(
					deviceId,
					collectionId,
				);

				if (!photoCollection) {
					Alert.alert("Coleção não encontrada");

					router.back();
					return;
				}

				setName(photoCollection.name);
			} catch (error) {
				console.error(error);

				Alert.alert("Erro", "Não foi possível carregar a coleção.");
			} finally {
				setLoading(false);
			}
		};

		loadCollection();
	}, [deviceId, collectionId]);

	const save = async () => {
		const trimmedName = name.trim();

		if (!trimmedName) {
			Alert.alert("Nome obrigatório", "Digite um nome para a coleção.");

			return;
		}

		try {
			setSaving(true);

			if (collectionId) {
				await renamePhotoCollection(
					deviceId,
					collectionId,
					trimmedName,
				);
			} else {
				await createPhotoCollection(deviceId, trimmedName);
			}

			router.back();
		} catch (error) {
			console.error(error);

			Alert.alert("Erro", "Não foi possível salvar a coleção.");
		} finally {
			setSaving(false);
		}
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
					title: collectionId ? "Editar coleção" : "Nova coleção",
				}}
			/>

			<View style={styles.container}>
				<Text style={styles.label}>Nome</Text>

				<TextInput
					value={name}
					onChangeText={setName}
					placeholder="Ex.: Família"
					autoFocus
					style={styles.input}
				/>

				<Pressable
					disabled={saving}
					style={[styles.button, saving && styles.buttonDisabled]}
					onPress={save}
				>
					<Text style={styles.buttonText}>
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
		justifyContent: "center",
		alignItems: "center",
	},

	label: {
		fontSize: 15,
		fontWeight: "600",
		marginBottom: 8,
	},

	input: {
		borderWidth: 1,
		borderColor: "#cccccc",
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 14,
		fontSize: 16,
	},

	button: {
		marginTop: 24,
		backgroundColor: "#6b6b6b",
		borderRadius: 12,
		paddingVertical: 14,
		alignItems: "center",
	},

	buttonDisabled: {
		opacity: 0.5,
	},

	buttonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
});
