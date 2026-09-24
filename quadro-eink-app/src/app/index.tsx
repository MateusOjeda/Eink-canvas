import { useCallback, useRef, useState } from "react";

import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { router, useFocusEffect } from "expo-router";

import { Feather, Ionicons } from "@expo/vector-icons";

import { getDevices } from "@/firebase/devices";

import { deleteDeviceWithContent } from "@/firebase/cascade";

import type { Device } from "@/types/device";

export default function HomeScreen() {
	const [devices, setDevices] = useState<Device[] | null>(null);

	const hasHandledInitialLoad = useRef(false);

	useFocusEffect(
		useCallback(() => {
			const loadDevices = async () => {
				const loadedDevices = await getDevices();

				setDevices(loadedDevices);

				// A entrada automática no único device
				// só acontece na primeira carga da Home.
				if (!hasHandledInitialLoad.current) {
					hasHandledInitialLoad.current = true;

					if (loadedDevices.length === 1) {
						router.push({
							pathname: "/device/[deviceId]",

							params: {
								deviceId: loadedDevices[0].id,
							},
						});
					}
				}
			};

			loadDevices();
		}, []),
	);

	const handleDeleteDevice = (device: Device) => {
		Alert.alert("Excluir quadro", `Excluir "${device.name}"?`, [
			{
				text: "Cancelar",
				style: "cancel",
			},
			{
				text: "Excluir",
				style: "destructive",

				onPress: async () => {
					try {
						await deleteDeviceWithContent(device.id);

						setDevices(
							(current) =>
								current?.filter(
									(item) => item.id !== device.id,
								) ?? null,
						);
					} catch (error) {
						console.error("Erro ao excluir quadro:", error);

						Alert.alert(
							"Erro",
							"Não foi possível excluir o quadro.",
						);
					}
				},
			},
		]);
	};

	if (!devices) {
		return <View style={styles.container} />;
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Meus quadros</Text>

			<View style={styles.deviceList}>
				{devices.map((device) => (
					<View key={device.id} style={styles.deviceCard}>
						<Pressable
							style={styles.deviceInfo}
							onPress={() =>
								router.push({
									pathname: "/device/[deviceId]",

									params: {
										deviceId: device.id,
									},
								})
							}
						>
							<Text style={styles.deviceName}>{device.name}</Text>

							<Text style={styles.deviceModel}>
								{device.displayType === "spectra6-13.3"
									? 'Spectra 6 — 13,3"'
									: 'Spectra 6 — 7,3"'}
							</Text>
						</Pressable>

						<View style={styles.deviceActions}>
							<Pressable
								hitSlop={10}
								onPress={() =>
									router.push({
										pathname: "/device/[deviceId]/edit",

										params: {
											deviceId: device.id,
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
								onPress={() => handleDeleteDevice(device)}
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
				onPress={() => router.push("/register-device")}
			>
				<Text style={styles.addButtonText}>Adicionar dispositivo</Text>
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

	title: {
		fontSize: 26,
		fontWeight: "700",
		marginBottom: 24,
	},

	deviceList: {
		gap: 12,
	},

	deviceCard: {
		borderWidth: 1,
		borderColor: "#dddddd",
		borderRadius: 12,
		padding: 18,

		flexDirection: "row",
		alignItems: "center",
	},

	deviceInfo: {
		flex: 1,
	},

	deviceName: {
		fontSize: 17,
		fontWeight: "600",
	},

	deviceModel: {
		marginTop: 4,
		fontSize: 13,
		color: "#666666",
	},

	deviceActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 15,
	},

	addButton: {
		marginTop: 20,
		backgroundColor: "#111111",
		borderRadius: 12,
		paddingVertical: 16,
		alignItems: "center",
	},

	addButtonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
});
