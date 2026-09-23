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

import { getDevice, updateDevice } from "@/firebase/devices";

export default function EditDeviceScreen() {
	const { deviceId } = useLocalSearchParams<{
		deviceId: string;
	}>();

	const [name, setName] = useState("");

	const [updateIntervalMinutes, setUpdateIntervalMinutes] = useState("");

	const [loading, setLoading] = useState(true);

	const [saving, setSaving] = useState(false);

	useEffect(() => {
		const loadDevice = async () => {
			try {
				const device = await getDevice(deviceId);

				if (!device) {
					Alert.alert("Dispositivo não encontrado");

					router.back();
					return;
				}

				setName(device.name);

				setUpdateIntervalMinutes(
					device.updateIntervalMinutes.toString(),
				);
			} catch (error) {
				console.error(error);

				Alert.alert("Erro", "Não foi possível carregar o dispositivo.");
			} finally {
				setLoading(false);
			}
		};

		loadDevice();
	}, [deviceId]);

	const save = async () => {
		const trimmedName = name.trim();

		const interval = Number(updateIntervalMinutes);

		if (!trimmedName) {
			Alert.alert("Nome obrigatório", "Digite um nome para o quadro.");

			return;
		}

		if (!Number.isInteger(interval) || interval <= 0) {
			Alert.alert(
				"Intervalo inválido",
				"Digite um número inteiro de minutos.",
			);

			return;
		}

		try {
			setSaving(true);

			await updateDevice(deviceId, {
				name: trimmedName,
				updateIntervalMinutes: interval,
			});

			router.back();
		} catch (error) {
			console.error(error);

			Alert.alert("Erro", "Não foi possível salvar as alterações.");
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator />
			</View>
		);
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: "Editar quadro",
				}}
			/>

			<View style={styles.container}>
				<Text style={styles.label}>Nome</Text>

				<TextInput
					value={name}
					onChangeText={setName}
					style={styles.input}
					placeholder="Quadro da sala"
				/>

				<Text style={styles.label}>Intervalo de atualização</Text>

				<View style={styles.intervalRow}>
					<TextInput
						value={updateIntervalMinutes}
						onChangeText={setUpdateIntervalMinutes}
						keyboardType="number-pad"
						style={[styles.input, styles.intervalInput]}
					/>

					<Text style={styles.minutes}>minutos</Text>
				</View>

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

	loadingContainer: {
		flex: 1,
		backgroundColor: "#ffffff",
		alignItems: "center",
		justifyContent: "center",
	},

	label: {
		fontSize: 15,
		fontWeight: "600",
		marginTop: 18,
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

	intervalRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},

	intervalInput: {
		flex: 1,
	},

	minutes: {
		fontSize: 16,
		color: "#666666",
	},

	saveButton: {
		marginTop: 32,
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
