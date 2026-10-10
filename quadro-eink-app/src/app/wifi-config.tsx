import React, { useEffect, useRef, useState } from "react";
import {
	PermissionsAndroid,
	Platform,
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";

import {
	ESPDevice,
	ESPProvisionManager,
	ESPSecurity,
	ESPTransport,
} from "@orbital-systems/react-native-esp-idf-provisioning";

import { BleManager } from "react-native-ble-plx";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { updateDeviceAuthUid } from "@/firebase/devices";

import { colors, radius, spacing, typography } from "@/theme";

const SERVICE_NAME = "QuadroEink";
const POP = "12345678";

const DEVICE_SERVICE_UUID = "7b7c0001-4e69-4d91-9a31-7d5e8f000001";

const DEVICE_MAC_CHARACTERISTIC_UUID = "7b7c0002-4e69-4d91-9a31-7d5e8f000001";

const STATUS_SERVICE_UUID = "7b7c1001-4e69-4d91-9a31-7d5e8f000001";

const STATUS_CHARACTERISTIC_UUID = "7b7c1002-4e69-4d91-9a31-7d5e8f000001";

const STATUS_DEVICE_NAME = "QuadroEinkStatus";

export type DisplayType = "spectra6-7.3" | "spectra6-13.3";

const textToBase64 = (text: string): string => {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

	let result = "";

	for (let i = 0; i < text.length; i += 3) {
		const a = text.charCodeAt(i);
		const b = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
		const c = i + 2 < text.length ? text.charCodeAt(i + 2) : 0;

		const triple = (a << 16) | (b << 8) | c;

		result += chars[(triple >> 18) & 63];
		result += chars[(triple >> 12) & 63];
		result += i + 1 < text.length ? chars[(triple >> 6) & 63] : "=";
		result += i + 2 < text.length ? chars[triple & 63] : "=";
	}

	return result;
};

function base64ToText(value: string): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

	let buffer = 0;
	let bits = 0;
	let result = "";

	for (const char of value.replace(/=+$/, "")) {
		const index = chars.indexOf(char);

		if (index === -1) {
			continue;
		}

		buffer = (buffer << 6) | index;
		bits += 6;

		if (bits >= 8) {
			bits -= 8;
			result += String.fromCharCode((buffer >> bits) & 0xff);
		}
	}

	return result;
}

type DeviceInfo = {
	mac: string;
	displayType: DisplayType;
};

export default function WifiConfigScreen() {
	const router = useRouter();

	const { mode } = useLocalSearchParams<{
		mode?: "register" | "wifi-only";
	}>();

	const isWifiOnly = mode === "wifi-only";

	const bleManager = useRef(new BleManager()).current;

	const [scanning, setScanning] = useState(false);
	const [device, setDevice] = useState<ESPDevice | null>(null);
	const [connecting, setConnecting] = useState(false);

	const [ssid, setSsid] = useState("");
	const [password, setPassword] = useState("");
	const [provisioning, setProvisioning] = useState(false);

	const [wifiMac, setWifiMac] = useState<string | null>(null);
	const [displayType, setDisplayType] = useState<DisplayType | null>(null);
	const [readingMac, setReadingMac] = useState(false);
	const [startingProvisioning, setStartingProvisioning] = useState(false);

	useEffect(() => {
		return () => {
			bleManager.stopDeviceScan();
			bleManager.destroy();
		};
	}, [bleManager]);

	useEffect(() => {
		return () => {
			if (device) {
				try {
					device.disconnect();
				} catch (error) {
					console.log("Erro ao desconectar:", error);
				}
			}
		};
	}, [device]);

	const requestBluetoothPermission = async () => {
		if (Platform.OS !== "android") {
			return true;
		}

		if (Platform.Version >= 31) {
			const result = await PermissionsAndroid.requestMultiple([
				PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
				PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
			]);

			return (
				result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
					PermissionsAndroid.RESULTS.GRANTED &&
				result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
					PermissionsAndroid.RESULTS.GRANTED
			);
		}

		const result = await PermissionsAndroid.request(
			PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
		);

		return result === PermissionsAndroid.RESULTS.GRANTED;
	};

	const identifyDeviceAndRequestProvisioning =
		async (): Promise<DeviceInfo | null> => {
			setReadingMac(true);

			return new Promise((resolve) => {
				let finished = false;

				const finish = (deviceInfo: DeviceInfo | null) => {
					if (finished) {
						return;
					}

					finished = true;
					bleManager.stopDeviceScan();
					setReadingMac(false);
					resolve(deviceInfo);
				};

				console.log("=== PROCURANDO BLE DO QUADRO ===");

				bleManager.startDeviceScan(
					null,
					null,
					async (error, scannedDevice) => {
						if (error) {
							console.log("Erro no scan BLE:", error);
							finish(null);
							return;
						}

						if (!scannedDevice) {
							return;
						}

						console.log(
							"BLE encontrado:",
							scannedDevice.name,
							scannedDevice.localName,
							scannedDevice.id,
						);

						if (
							scannedDevice.name !== SERVICE_NAME &&
							scannedDevice.localName !== SERVICE_NAME
						) {
							return;
						}

						bleManager.stopDeviceScan();

						try {
							console.log("Conectando ao BLE...");

							const connectedDevice =
								await scannedDevice.connect();

							console.log("BLE conectado.");

							await connectedDevice.discoverAllServicesAndCharacteristics();

							console.log("Serviços BLE descobertos.");

							const characteristic =
								await connectedDevice.readCharacteristicForService(
									DEVICE_SERVICE_UUID,
									DEVICE_MAC_CHARACTERISTIC_UUID,
								);

							console.log(
								"Informações recebidas em Base64:",
								characteristic.value,
							);

							if (!characteristic.value) {
								throw new Error(
									"Característica não retornou nenhum valor.",
								);
							}

							const deviceInfoString = base64ToText(
								characteristic.value,
							);

							console.log(
								"Informações do dispositivo:",
								deviceInfoString,
							);

							const [mac, type] = deviceInfoString.split("|");

							if (!mac || !type) {
								throw new Error(
									"Informações do dispositivo inválidas.",
								);
							}

							if (
								type !== "spectra6-7.3" &&
								type !== "spectra6-13.3"
							) {
								throw new Error(
									`Tipo de dispositivo desconhecido: ${type}`,
								);
							}

							const deviceInfo: DeviceInfo = {
								mac,
								displayType: type,
							};

							console.log("MAC decodificado:", mac);
							console.log("Tipo do dispositivo:", type);

							console.log(
								"Solicitando início do provisioning...",
							);

							await connectedDevice.writeCharacteristicWithResponseForService(
								DEVICE_SERVICE_UUID,
								DEVICE_MAC_CHARACTERISTIC_UUID,
								textToBase64("PROVISION"),
							);

							console.log("Comando PROVISION enviado.");

							try {
								await connectedDevice.cancelConnection();
								console.log("BLE desconectado.");
							} catch (error) {
								console.log(
									"BLE já estava desconectado pelo quadro.",
								);
							}

							finish(deviceInfo);
						} catch (connectionError) {
							console.log(
								"Erro ao identificar/solicitar provisioning:",
								connectionError,
							);

							try {
								await scannedDevice.cancelConnection();
							} catch {}

							finish(null);
						}
					},
				);
			});
		};

	const scan = async () => {
		const hasPermission = await requestBluetoothPermission();

		console.log("Permissão Bluetooth concedida:", hasPermission);

		if (!hasPermission) {
			Alert.alert(
				"Permissão necessária",
				"Permita o acesso ao Bluetooth para procurar o Quadro E Ink.",
			);
			return;
		}

		try {
			setDevice(null);
			setWifiMac(null);
			setDisplayType(null);
			setScanning(true);

			console.log("=== IDENTIFICANDO QUADRO ===");

			const deviceInfo = await identifyDeviceAndRequestProvisioning();

			if (!deviceInfo) {
				Alert.alert(
					"Quadro não encontrado",
					"Não foi possível identificar o Quadro E Ink. Verifique se ele está ligado e com o SW2 pressionado.",
				);
				return;
			}

			console.log("MAC do quadro:", deviceInfo.mac);
			console.log("Tipo do quadro:", deviceInfo.displayType);

			setWifiMac(deviceInfo.mac);
			setDisplayType(deviceInfo.displayType);
			setStartingProvisioning(true);

			await new Promise((resolve) => setTimeout(resolve, 3000));

			console.log("=== PROCURANDO PROVISIONAMENTO WI-FI ===");

			const devices = await ESPProvisionManager.searchESPDevices(
				"PROV_QuadroEink",
				ESPTransport.ble,
				ESPSecurity.secure,
			);

			console.log(
				"Dispositivos de provisionamento encontrados:",
				devices,
			);

			if (devices.length === 0) {
				Alert.alert(
					"Quadro encontrado",
					"Foi possível identificar o quadro, mas não foi possível iniciar a configuração Wi-Fi.",
				);
				return;
			}

			const foundDevice = devices[0];

			console.log("QuadroEink encontrado para provisionamento.");

			setDevice(foundDevice);
		} catch (error) {
			console.log("Erro ao procurar QuadroEink:", error);

			Alert.alert("Erro", "Não foi possível encontrar o Quadro E Ink.");
		} finally {
			setScanning(false);
			setReadingMac(false);
			setStartingProvisioning(false);
		}
	};

	const waitForWifiStatus = async (): Promise<string | null> => {
		return new Promise((resolve) => {
			let finished = false;

			const finish = (status: string | null) => {
				if (finished) {
					return;
				}

				finished = true;
				bleManager.stopDeviceScan();
				resolve(status);
			};

			console.log("=== PROCURANDO STATUS DO WI-FI ===");

			bleManager.startDeviceScan(
				null,
				null,
				async (error, scannedDevice) => {
					if (error) {
						console.log("Erro no scan do status BLE:", error);
						finish(null);
						return;
					}

					if (!scannedDevice) {
						return;
					}

					if (
						scannedDevice.name !== STATUS_DEVICE_NAME &&
						scannedDevice.localName !== STATUS_DEVICE_NAME
					) {
						return;
					}

					console.log(
						"BLE de status encontrado:",
						scannedDevice.name,
						scannedDevice.localName,
						scannedDevice.id,
					);

					bleManager.stopDeviceScan();

					try {
						const connectedDevice = await scannedDevice.connect();

						console.log("BLE de status conectado.");

						await connectedDevice.discoverAllServicesAndCharacteristics();

						console.log("Serviços do BLE de status descobertos.");

						const characteristic =
							await connectedDevice.readCharacteristicForService(
								STATUS_SERVICE_UUID,
								STATUS_CHARACTERISTIC_UUID,
							);

						console.log(
							"Status recebido em Base64:",
							characteristic.value,
						);

						if (!characteristic.value) {
							throw new Error(
								"Característica de status não retornou nenhum valor.",
							);
						}

						const status = base64ToText(characteristic.value);

						console.log("Status do Wi-Fi:", status);

						await connectedDevice.cancelConnection();

						finish(status);
					} catch (error) {
						console.log("Erro ao ler status do Wi-Fi:", error);

						try {
							await scannedDevice.cancelConnection();
						} catch {}

						finish(null);
					}
				},
			);

			setTimeout(() => {
				finish(null);
			}, 30000);
		});
	};

	const connectAndProvision = async () => {
		if (!device) {
			return;
		}

		if (!ssid.trim()) {
			Alert.alert("SSID necessário", "Digite o nome da rede Wi-Fi.");
			return;
		}

		try {
			setConnecting(true);
			setProvisioning(true);

			console.log("Conectando ao QuadroEink...");
			console.log("Security: 1");
			console.log("POP:", POP);
			console.log("MAC do quadro:", wifiMac);
			console.log("Tipo do quadro:", displayType);

			await device.connect(POP);

			console.log("Provisionamento BLE conectado.");

			console.log("Enviando configuração Wi-Fi...");

			console.log("SSID:", ssid);
			console.log("Senha:", password ? "********" : "(vazia)");

			await device.provision(ssid.trim(), password);

			console.log("Configuração Wi-Fi enviada com sucesso.");

			const wifiStatus = await waitForWifiStatus();

			console.log("Resultado do status Wi-Fi:", wifiStatus);

			const [status, firebaseUid] = wifiStatus?.split("|") ?? [];

			if (status !== "WIFI_CONNECTED" || !firebaseUid) {
				throw new Error(
					`Wi-Fi não foi confirmado. Status: ${wifiStatus ?? "nenhum"}`,
				);
			}

			console.log("Wi-Fi confirmado pelo quadro.");
			console.log("Firebase UID:", firebaseUid);

			if (isWifiOnly) {
				await updateDeviceAuthUid(wifiMac!, firebaseUid);

				router.back();
				return;
			}

			router.push({
				pathname: "/register-device",
				params: {
					id: wifiMac,
					displayType,
					firebaseUid,
				},
			});
		} catch (error) {
			console.log("Erro ao configurar Wi-Fi:", error);

			try {
				device.disconnect();
			} catch (disconnectError) {
				console.log("Erro ao desconectar após falha:", disconnectError);
			}

			setDevice(null);

			Alert.alert(
				"Não foi possível configurar o Wi-Fi",
				"Verifique o nome e a senha da rede e tente novamente.",
				[
					{
						text: "OK",
						onPress: () => router.replace("/"),
					},
				],
			);

			return;
		} finally {
			setConnecting(false);
			setProvisioning(false);
		}
	};

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<Screen>
				<ScreenHeader
					title="Configurar Wi-Fi"
					subtitle="Conecte seu quadro para configurar a rede."
					showBackButton
					onBackPress={() => router.back()}
				/>

				<KeyboardAvoidingView
					style={styles.keyboardView}
					behavior={Platform.OS === "ios" ? "padding" : undefined}
				>
					<ScrollView
						contentContainerStyle={styles.content}
						keyboardShouldPersistTaps="handled"
						showsVerticalScrollIndicator={false}
					>
						<View style={styles.statusCard}>
							<View
								style={[
									styles.statusDot,
									device && styles.statusDotConnected,
								]}
							/>

							<View style={styles.statusTextContainer}>
								<Text style={styles.statusTitle}>
									{device
										? "Quadro encontrado"
										: scanning
											? readingMac
												? "Identificando quadro..."
												: "Procurando quadro..."
											: "Quadro não encontrado"}
								</Text>

								<Text style={styles.statusDescription}>
									{device
										? "Preencha os dados da rede Wi-Fi."
										: scanning
											? "Entre no modo configuração do Quadro E Ink e deixe próximo ao celular."
											: "Procure por um Quadro E Ink próximo."}
								</Text>
							</View>
						</View>

						{device && (
							<View style={styles.deviceCard}>
								<View style={styles.deviceIcon}>
									<Text style={styles.deviceIconText}>E</Text>
								</View>

								<View style={styles.deviceInfo}>
									<Text style={styles.deviceName}>
										{SERVICE_NAME}
									</Text>

									<Text style={styles.deviceId}>
										{wifiMac ??
											"Identificando dispositivo..."}
									</Text>
								</View>

								{(connecting || readingMac) && (
									<ActivityIndicator />
								)}
							</View>
						)}

						{wifiMac && !device && (
							<View style={styles.deviceCard}>
								<View style={styles.deviceIcon}>
									<Text style={styles.deviceIconText}>E</Text>
								</View>

								<View style={styles.deviceInfo}>
									<Text style={styles.deviceName}>
										Quadro identificado
									</Text>

									<Text style={styles.deviceId}>
										{wifiMac}
									</Text>
								</View>

								{startingProvisioning && <ActivityIndicator />}
							</View>
						)}

						{device && (
							<View style={styles.wifiForm}>
								<Text style={styles.inputLabel}>
									Nome da rede Wi-Fi
								</Text>

								<TextInput
									style={styles.input}
									value={ssid}
									onChangeText={setSsid}
									placeholder="SSID"
									placeholderTextColor={colors.textSecondary}
									autoCapitalize="none"
									autoCorrect={false}
									editable={!connecting}
								/>

								<Text style={styles.inputLabel}>Senha</Text>

								<TextInput
									style={styles.input}
									value={password}
									onChangeText={setPassword}
									placeholder="Senha da rede"
									placeholderTextColor={colors.textSecondary}
									secureTextEntry
									autoCapitalize="none"
									autoCorrect={false}
									editable={!connecting}
								/>
							</View>
						)}

						<View style={styles.buttonContainer}>
							<PrimaryButton
								title={
									scanning
										? readingMac
											? "Identificando..."
											: "Procurando..."
										: device
											? connecting
												? "Conectando..."
												: "Conectar e configurar"
											: "Procurar quadro"
								}
								onPress={device ? connectAndProvision : scan}
								disabled={
									scanning ||
									connecting ||
									provisioning ||
									readingMac
								}
							/>
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
			</Screen>
		</>
	);
}

const styles = StyleSheet.create({
	keyboardView: {
		flex: 1,
	},

	content: {
		flexGrow: 1,
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.lg,
		paddingBottom: spacing.lg,
	},

	statusCard: {
		flexDirection: "row",
		alignItems: "center",
		padding: spacing.md,
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		marginBottom: spacing.md,
	},

	statusDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		backgroundColor: colors.textSecondary,
		marginRight: spacing.md,
	},

	statusDotConnected: {
		backgroundColor: colors.primary,
	},

	statusTextContainer: {
		flex: 1,
	},

	statusTitle: {
		...typography.body,
		fontWeight: "600",
		color: colors.text,
		marginBottom: 3,
	},

	statusDescription: {
		...typography.caption,
		color: colors.textSecondary,
	},

	deviceCard: {
		flexDirection: "row",
		alignItems: "center",
		padding: spacing.md,
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		marginBottom: spacing.md,
	},

	deviceIcon: {
		width: 42,
		height: 42,
		borderRadius: radius.sm,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: colors.primary,
		marginRight: spacing.md,
	},

	deviceIconText: {
		color: "#FFFFFF",
		fontSize: 20,
		fontWeight: "700",
	},

	deviceInfo: {
		flex: 1,
	},

	deviceName: {
		...typography.body,
		fontWeight: "600",
		color: colors.text,
	},

	deviceId: {
		...typography.caption,
		color: colors.textSecondary,
		marginTop: 3,
	},

	wifiForm: {
		marginTop: spacing.md,
		gap: spacing.sm,
	},

	inputLabel: {
		...typography.caption,
		color: colors.text,
		marginTop: spacing.sm,
	},

	input: {
		height: 48,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderRadius: radius.sm,
		color: colors.text,
		borderWidth: 1,
		borderColor: colors.border,
	},

	buttonContainer: {
		marginTop: "auto",
		paddingTop: spacing.lg,
	},
});
