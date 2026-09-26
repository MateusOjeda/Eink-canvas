import { useCallback, useState } from "react";

import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { router, Stack, useFocusEffect } from "expo-router";

import { Feather, Ionicons } from "@expo/vector-icons";

import { getDevices } from "@/firebase/devices";

import { deleteDeviceWithContent } from "@/firebase/cascade";

import { signOutUser } from "@/firebase/auth";

import type { Device } from "@/types/device";

export default function HomeScreen() {
	const [devices, setDevices] = useState<Device[] | null>(null);

	const [profileMenuOpen, setProfileMenuOpen] = useState(false);

	useFocusEffect(
		useCallback(() => {
			const loadDevices = async () => {
				const loadedDevices = await getDevices();

				setDevices(loadedDevices);
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

	const handleLogout = async () => {
		try {
			setProfileMenuOpen(false);

			await signOutUser();
		} catch (error) {
			console.error("Erro ao sair:", error);

			Alert.alert("Erro", "Não foi possível sair da conta.");
		}
	};

	return (
		<>
			<Stack.Screen
				options={{
					headerRight: () => (
						<Pressable
							hitSlop={12}
							onPress={() =>
								setProfileMenuOpen((current) => !current)
							}
						>
							<Ionicons
								name="person-circle-outline"
								size={30}
								color="#666666"
							/>
						</Pressable>
					),
				}}
			/>

			<Modal
				visible={profileMenuOpen}
				transparent
				animationType="fade"
				onRequestClose={() => setProfileMenuOpen(false)}
			>
				<Pressable
					style={styles.modalOverlay}
					onPress={() => setProfileMenuOpen(false)}
				>
					<View style={styles.profileMenu}>
						<Pressable
							style={styles.profileMenuItem}
							onPress={handleLogout}
						>
							<Ionicons
								name="log-out-outline"
								size={20}
								color="#444444"
							/>

							<Text style={styles.profileMenuText}>
								Sair da conta
							</Text>
						</Pressable>
					</View>
				</Pressable>
			</Modal>

			<View style={styles.container}>
				{devices && (
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
									<Text style={styles.deviceName}>
										{device.name}
									</Text>

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
												pathname:
													"/device/[deviceId]/edit",

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
										onPress={() =>
											handleDeleteDevice(device)
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
				)}

				<Pressable
					style={styles.addButton}
					onPress={() => router.push("/register-device")}
				>
					<Text style={styles.addButtonText}>
						Adicionar dispositivo
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

	sectionTitle: {
		fontSize: 22,
		fontWeight: "700",

		marginBottom: 20,
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

	modalOverlay: {
		flex: 1,

		alignItems: "flex-end",

		paddingTop: 88,
		paddingRight: 12,
	},

	profileMenu: {
		width: 180,

		backgroundColor: "#ffffff",

		borderWidth: 1,
		borderColor: "#dddddd",

		borderRadius: 10,

		shadowColor: "#000000",

		shadowOffset: {
			width: 0,
			height: 2,
		},

		shadowOpacity: 0.12,
		shadowRadius: 6,

		elevation: 5,
	},

	profileMenuItem: {
		flexDirection: "row",
		alignItems: "center",

		gap: 10,

		paddingHorizontal: 16,
		paddingVertical: 14,
	},

	profileMenuText: {
		fontSize: 15,

		color: "#333333",
	},
});
