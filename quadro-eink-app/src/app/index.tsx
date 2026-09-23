import { useCallback, useRef, useState } from "react";

import { Pressable, StyleSheet, Text, View } from "react-native";

import { router, useFocusEffect } from "expo-router";

import { getDevices } from "@/firebase/devices";
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

	if (!devices) {
		return <View style={styles.container} />;
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Meus quadros</Text>

			<View style={styles.deviceList}>
				{devices.map((device) => (
					<Pressable
						key={device.id}
						style={styles.deviceButton}
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

	deviceButton: {
		borderWidth: 1,
		borderColor: "#dddddd",
		borderRadius: 12,
		padding: 18,
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
