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

import type { DisplayOrientation } from "@/types/display";

import { MIN_UPDATE_INTERVAL_MINUTES } from "@/constants/device";

export default function EditDeviceScreen() {
	const { deviceId } = useLocalSearchParams<{
		deviceId: string;
	}>();

	const [orientation, setOrientation] =
		useState<DisplayOrientation>("portrait");

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

				setOrientation(device.orientation);

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

		if (
			!Number.isInteger(interval) ||
			interval < MIN_UPDATE_INTERVAL_MINUTES
		) {
			Alert.alert(
				"Intervalo inválido",
				`O intervalo mínimo de atualização é de ${MIN_UPDATE_INTERVAL_MINUTES} minutos.`,
			);

			return;
		}

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
				orientation,
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

	const interval = Number(updateIntervalMinutes);

	const invalidInterval =
		updateIntervalMinutes.length > 0 &&
		(!Number.isInteger(interval) || interval < MIN_UPDATE_INTERVAL_MINUTES);

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

				<Text style={styles.label}>Orientação</Text>

				<Pressable
					style={styles.option}
					onPress={() => setOrientation("portrait")}
				>
					<Text>
						{orientation === "portrait" ? "● " : "○ "}
						Retrato
					</Text>
				</Pressable>

				<Pressable
					style={styles.option}
					onPress={() => setOrientation("landscape")}
				>
					<Text>
						{orientation === "landscape" ? "● " : "○ "}
						Paisagem
					</Text>
				</Pressable>

				<Text style={styles.label}>Intervalo de atualização</Text>

				<TextInput
					value={updateIntervalMinutes}
					onChangeText={setUpdateIntervalMinutes}
					keyboardType="number-pad"
					placeholder="120"
					style={[styles.input, invalidInterval && styles.inputError]}
				/>

				<Text
					style={[
						styles.helperText,

						invalidInterval && styles.errorText,
					]}
				>
					{invalidInterval
						? "O mínimo é 120 minutos."
						: "Mínimo: 120 minutos"}
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
	option: {
		paddingVertical: 10,
	},
	inputError: {
		borderColor: "#c62828",
	},

	helperText: {
		marginTop: 6,

		fontSize: 12,

		color: "#777777",
	},

	errorText: {
		color: "#c62828",
	},
});
