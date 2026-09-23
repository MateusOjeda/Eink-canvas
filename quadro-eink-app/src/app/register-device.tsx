import { useState } from "react";

import {
	Alert,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

import { router } from "expo-router";

import { createDevice } from "@/firebase/devices";

import type { DisplayType } from "@/types/display";

export default function RegisterDeviceScreen() {
	const [deviceId, setDeviceId] = useState("");
	const [name, setName] = useState("");

	const [displayType, setDisplayType] =
		useState<DisplayType>("spectra6-13.3");

	const [updateIntervalMinutes, setUpdateIntervalMinutes] = useState("120");

	const [saving, setSaving] = useState(false);

	const saveDevice = async () => {
		const id = deviceId.trim();
		const deviceName = name.trim();

		const interval = Number(updateIntervalMinutes);

		if (!id) {
			Alert.alert("ID obrigatório", "Digite o ID do dispositivo.");
			return;
		}

		if (!deviceName) {
			Alert.alert(
				"Nome obrigatório",
				"Digite um nome para o dispositivo.",
			);
			return;
		}

		if (!Number.isInteger(interval) || interval <= 0) {
			Alert.alert("Intervalo inválido", "Digite o intervalo em minutos.");
			return;
		}

		try {
			setSaving(true);

			await createDevice({
				id,
				name: deviceName,
				displayType,
				updateIntervalMinutes: interval,
			});

			router.back();
		} catch (error) {
			console.error(error);

			Alert.alert(
				"Não foi possível adicionar",
				error instanceof Error ? error.message : "Erro desconhecido.",
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.label}>ID do dispositivo</Text>

			<TextInput
				value={deviceId}
				onChangeText={setDeviceId}
				placeholder="d73584a9e12b4e5c..."
				autoCapitalize="none"
				autoCorrect={false}
				style={styles.input}
			/>

			<Text style={styles.label}>Nome</Text>

			<TextInput
				value={name}
				onChangeText={setName}
				placeholder="Quadro da sala"
				style={styles.input}
			/>

			<Text style={styles.label}>Modelo</Text>

			<Pressable
				style={styles.option}
				onPress={() => setDisplayType("spectra6-13.3")}
			>
				<Text>
					{displayType === "spectra6-13.3" ? "● " : "○ "}
					Spectra 6 — 13,3"
				</Text>
			</Pressable>

			<Pressable
				style={styles.option}
				onPress={() => setDisplayType("spectra6-7.3")}
			>
				<Text>
					{displayType === "spectra6-7.3" ? "● " : "○ "}
					Spectra 6 — 7,3"
				</Text>
			</Pressable>

			<Text style={styles.label}>Intervalo de atualização (minutos)</Text>

			<TextInput
				value={updateIntervalMinutes}
				onChangeText={setUpdateIntervalMinutes}
				keyboardType="number-pad"
				style={styles.input}
			/>

			<Pressable
				disabled={saving}
				style={styles.button}
				onPress={saveDevice}
			>
				<Text style={styles.buttonText}>
					{saving ? "Adicionando..." : "Adicionar dispositivo"}
				</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#ffffff",
		padding: 24,
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

	option: {
		paddingVertical: 10,
	},

	button: {
		marginTop: 32,
		backgroundColor: "#111111",
		borderRadius: 12,
		paddingVertical: 16,
		alignItems: "center",
	},

	buttonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
});
