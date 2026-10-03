import { useCallback, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Image,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

import { router, Stack, useFocusEffect } from "expo-router";

import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, shadows, spacing, typography } from "@/theme";

import { getDevices } from "@/firebase/devices";
import { getCollections } from "@/firebase/collections";
import { deleteDeviceWithContent } from "@/firebase/cascade";
import { signOutUser } from "@/firebase/auth";

import type { Device } from "@/types/device";

type HomeDevice = Device & {
	collectionCount: number;
};

const PLACEHOLDER_IMAGES = [
	require("../../assets/placeholders/home-device-1.png"),
	require("../../assets/placeholders/home-device-2.png"),
	require("../../assets/placeholders/home-device-3.png"),
];

function getDisplayTypeLabel(displayType: Device["displayType"]) {
	return displayType === "spectra6-13.3"
		? 'Spectra 6 — 13,3"'
		: 'Spectra 6 — 7,3"';
}

function getCollectionLabel(count: number) {
	return count === 1 ? "1 coleção" : `${count} coleções`;
}

export default function HomeScreen() {
	const [devices, setDevices] = useState<HomeDevice[]>([]);
	const [loadingDevices, setLoadingDevices] = useState(true);
	const [profileMenuOpen, setProfileMenuOpen] = useState(false);

	useFocusEffect(
		useCallback(() => {
			const loadDevices = async () => {
				try {
					setLoadingDevices(true);

					const loadedDevices = await getDevices();

					const devicesWithCollectionCount = await Promise.all(
						loadedDevices.map(async (device) => {
							const collections = await getCollections(device.id);

							return {
								...device,
								collectionCount: collections.length,
							};
						}),
					);

					setDevices(devicesWithCollectionCount);
				} finally {
					setLoadingDevices(false);
				}
			};

			loadDevices();
		}, []),
	);

	const handleOpenDevice = (deviceId: string) => {
		router.push({
			pathname: "/device/[deviceId]",
			params: {
				deviceId,
			},
		});
	};

	const handleDeleteDevice = (device: HomeDevice) => {
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

						setDevices((current) =>
							current.filter((item) => item.id !== device.id),
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
			<Stack.Screen options={{ headerShown: false }} />

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
							style={({ pressed }) => [
								styles.profileMenuItem,
								pressed && styles.profileMenuItemPressed,
							]}
							onPress={handleLogout}
						>
							<Ionicons
								name="log-out-outline"
								size={20}
								color={colors.textSecondary}
							/>

							<Text style={styles.profileMenuText}>
								Sair da conta
							</Text>
						</Pressable>
					</View>
				</Pressable>
			</Modal>

			<Screen scroll>
				<ScreenHeader
					title="Meus quadros"
					subtitle="Escolha um quadro para gerenciar"
					rightAction={
						<IconButton
							accessibilityLabel="Abrir menu do perfil"
							onPress={() =>
								setProfileMenuOpen((current) => !current)
							}
							style={styles.profileButton}
							icon={
								<MaterialCommunityIcons
									name="account-circle-outline"
									size={30}
									color={colors.text}
								/>
							}
						/>
					}
				/>

				{loadingDevices ? (
					<View style={styles.deviceLoading}>
						<ActivityIndicator color={colors.primary} />
					</View>
				) : (
					<View style={styles.deviceList}>
						{devices.map((device, index) => (
							<Card
								key={device.id}
								style={styles.deviceCard}
								padding="lg"
							>
								<View style={styles.deviceLayout}>
									<Pressable
										onPress={() =>
											handleOpenDevice(device.id)
										}
										style={({ pressed }) => [
											styles.previewPressable,
											pressed && styles.devicePressed,
										]}
									>
										<Image
											source={
												PLACEHOLDER_IMAGES[
													index %
														PLACEHOLDER_IMAGES.length
												]
											}
											style={styles.devicePreview}
											resizeMode="cover"
										/>
									</Pressable>

									<View style={styles.deviceContent}>
										<Pressable
											onPress={() =>
												handleOpenDevice(device.id)
											}
											style={({ pressed }) => [
												styles.deviceInfo,
												pressed && styles.devicePressed,
											]}
										>
											<Text style={styles.deviceName}>
												{device.name}
											</Text>

											<Text style={styles.deviceModel}>
												{getDisplayTypeLabel(
													device.displayType,
												)}
											</Text>

											<View style={styles.metaRow}>
												<Feather
													name="clock"
													size={18}
													color={colors.textSecondary}
												/>

												<Text style={styles.metaText}>
													Intervalo:{" "}
													{
														device.updateIntervalMinutes
													}{" "}
													min
												</Text>
											</View>
										</Pressable>

										<View style={styles.bottomRow}>
											<Pressable
												onPress={() =>
													handleOpenDevice(device.id)
												}
												style={({ pressed }) => [
													styles.collectionInfo,
													pressed &&
														styles.devicePressed,
												]}
											>
												<MaterialCommunityIcons
													name="image-multiple-outline"
													size={20}
													color={colors.textSecondary}
												/>

												<Text style={styles.metaText}>
													{getCollectionLabel(
														device.collectionCount,
													)}
												</Text>
											</Pressable>

											<View style={styles.deviceActions}>
												<IconButton
													accessibilityLabel={`Editar ${device.name}`}
													onPress={() =>
														router.push({
															pathname:
																"/edit-device",
															params: {
																deviceId:
																	device.id,
															},
														})
													}
													icon={
														<MaterialCommunityIcons
															name="square-edit-outline"
															size={22}
															color={
																colors.textSecondary
															}
														/>
													}
												/>

												<IconButton
													accessibilityLabel={`Excluir ${device.name}`}
													onPress={() =>
														handleDeleteDevice(
															device,
														)
													}
													icon={
														<Ionicons
															name="trash-outline"
															size={20}
															color={
																colors.textSecondary
															}
														/>
													}
												/>
											</View>
										</View>
									</View>
								</View>
							</Card>
						))}
					</View>
				)}

				<PrimaryButton
					title="Adicionar dispositivo"
					style={styles.addButton}
					onPress={() =>
						router.push({
							pathname: "/wifi-config",
							params: {
								mode: "register",
							},
						})
					}
					leftIcon={
						<Ionicons name="add" size={28} color={colors.white} />
					}
				/>
			</Screen>
		</>
	);
}

const styles = StyleSheet.create({
	deviceLoading: {
		paddingVertical: spacing.xxl,
		alignItems: "center",
	},

	deviceList: {
		gap: spacing.xl,
	},

	deviceCard: {
		width: "100%",
	},

	deviceLayout: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.lg,
	},

	previewPressable: {
		flexShrink: 0,
	},

	devicePreview: {
		width: 86,
		height: 126,
		borderRadius: radius.md,
		backgroundColor: colors.surfaceMuted,
	},

	deviceContent: {
		flex: 1,
		minWidth: 0,
		alignSelf: "stretch",
		justifyContent: "space-between",
	},

	deviceInfo: {
		flexShrink: 1,
	},

	devicePressed: {
		opacity: 0.72,
	},

	deviceName: {
		...typography.cardTitle,
		color: colors.text,
	},

	deviceModel: {
		marginTop: spacing.xs,
		...typography.body,
		color: colors.textSecondary,
	},

	metaRow: {
		marginTop: spacing.md,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},

	metaText: {
		...typography.body,
		color: colors.textSecondary,
	},

	bottomRow: {
		marginTop: spacing.sm,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.sm,
	},

	collectionInfo: {
		flex: 1,
		minWidth: 0,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},

	deviceActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},

	addButton: {
		marginTop: spacing.xl,
	},

	profileButton: {
		width: 54,
		height: 54,
		borderRadius: 27,
	},

	modalOverlay: {
		flex: 1,
		alignItems: "flex-end",
		paddingTop: 88,
		paddingRight: spacing.md,
		backgroundColor: colors.overlay,
	},

	profileMenu: {
		width: 180,
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		overflow: "hidden",
		...shadows.popup,
	},

	profileMenuItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		paddingHorizontal: spacing.lg,
		paddingVertical: 14,
	},

	profileMenuItemPressed: {
		backgroundColor: colors.surfaceMuted,
	},

	profileMenuText: {
		...typography.body,
		color: colors.text,
	},
});
