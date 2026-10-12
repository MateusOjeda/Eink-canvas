import { useEffect, useState } from "react";

import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";

import { router, Stack, useLocalSearchParams } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, spacing, typography } from "@/theme";

import { getDevice, updateDevice } from "@/firebase/devices";

import type { DisplayOrientation } from "@/types/display";

import { useDeviceProcessing } from "@/contexts/DeviceProcessingContext";

function isValidTime(value: string) {
	return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export default function EditDeviceScreen() {
	const { deviceId } = useLocalSearchParams<{
		deviceId: string;
	}>();

	const [orientation, setOrientation] =
		useState<DisplayOrientation>("portrait");

	const [name, setName] = useState("");

	const [updateTimes, setUpdateTimes] = useState<string[]>([]);

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const deviceProcessing = useDeviceProcessing();

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

				setUpdateTimes(
					device.updateTimes?.length
						? [...device.updateTimes].sort()
						: [],
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

	const invalidTimes =
		updateTimes.some((time) => !isValidTime(time)) ||
		new Set(updateTimes).size !== updateTimes.length;

	const canSave =
		Boolean(name.trim()) &&
		updateTimes.length > 0 &&
		!invalidTimes &&
		!saving;

	const save = async () => {
		const trimmedName = name.trim();

		if (!trimmedName) {
			Alert.alert("Nome obrigatório", "Digite um nome para o quadro.");

			return;
		}

		if (
			updateTimes.length === 0 ||
			updateTimes.some((time) => !isValidTime(time)) ||
			new Set(updateTimes).size !== updateTimes.length
		) {
			Alert.alert(
				"Horários inválidos",
				"Adicione pelo menos um horário válido, sem duplicatas. Use o formato HH:MM.",
			);

			return;
		}

		try {
			setSaving(true);

			await updateDevice(deviceId, {
				name: trimmedName,
				orientation,
				updateTimes: [...updateTimes].sort(),
			});

			router.back();
		} catch (error) {
			console.error(error);

			Alert.alert("Erro", "Não foi possível salvar as alterações.");
		} finally {
			setSaving(false);
		}
	};

	const openWifiConfig = () => {
		router.push({
			pathname: "/wifi-config",
			params: {
				mode: "wifi-only",
			},
		});
	};

	if (loading) {
		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />

				<Screen>
					<View style={styles.loadingContainer}>
						<ActivityIndicator
							size="large"
							color={colors.primary}
						/>
					</View>
				</Screen>
			</>
		);
	}

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<KeyboardAvoidingView
				style={styles.keyboardView}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				<Screen
					scroll
					contentContainerStyle={styles.screenContent}
					keyboardShouldPersistTaps="handled"
				>
					<ScreenHeader
						title="Editar quadro"
						subtitle="Atualize as configurações do dispositivo."
						showBackButton
						style={styles.header}
						processing={deviceProcessing}
					/>

					<Text style={styles.label}>Nome do dispositivo</Text>

					<TextInput
						value={name}
						onChangeText={setName}
						style={styles.input}
						placeholder="Quadro da sala"
						placeholderTextColor={colors.textMuted}
					/>

					<Text style={styles.label}>Orientação padrão</Text>

					<View style={styles.orientationRow}>
						<Pressable
							onPress={() => setOrientation("portrait")}
							style={({ pressed }) => [
								styles.orientationCard,
								orientation === "portrait" &&
									styles.orientationCardSelected,
								pressed && styles.pressed,
							]}
						>
							<View style={styles.orientationSide}>
								<View
									style={[
										styles.radio,
										orientation === "portrait" &&
											styles.radioSelected,
									]}
								>
									{orientation === "portrait" ? (
										<View style={styles.radioDot} />
									) : null}
								</View>
							</View>

							<View style={styles.orientationContent}>
								<Ionicons
									name="phone-portrait-outline"
									size={24}
									color={
										orientation === "portrait"
											? colors.primaryPressed
											: colors.text
									}
								/>

								<Text
									style={[
										styles.orientationText,
										orientation === "portrait" &&
											styles.orientationTextSelected,
									]}
								>
									Retrato
								</Text>
							</View>

							<View style={styles.orientationSide} />
						</Pressable>

						<Pressable
							onPress={() => setOrientation("landscape")}
							style={({ pressed }) => [
								styles.orientationCard,
								orientation === "landscape" &&
									styles.orientationCardSelected,
								pressed && styles.pressed,
							]}
						>
							<View style={styles.orientationSide}>
								<View
									style={[
										styles.radio,
										orientation === "landscape" &&
											styles.radioSelected,
									]}
								>
									{orientation === "landscape" ? (
										<View style={styles.radioDot} />
									) : null}
								</View>
							</View>

							<View style={styles.orientationContent}>
								<Ionicons
									name="image-outline"
									size={25}
									color={
										orientation === "landscape"
											? colors.primaryPressed
											: colors.text
									}
								/>

								<Text
									style={[
										styles.orientationText,
										orientation === "landscape" &&
											styles.orientationTextSelected,
									]}
								>
									Paisagem
								</Text>
							</View>

							<View style={styles.orientationSide} />
						</Pressable>
					</View>

					<Text style={styles.label}>Horários das atualizações</Text>

					<Text style={styles.helperText}>
						O quadro atualizará as fotos nestes horários, todos os
						dias.
					</Text>

					{updateTimes.map((time, index) => (
						<View key={index} style={styles.scheduleRow}>
							<View style={styles.scheduleIcon}>
								<Ionicons
									name="time-outline"
									size={22}
									color={colors.primaryPressed}
								/>
							</View>

							<TextInput
								value={time}
								onChangeText={(value) =>
									setUpdateTimes((current) =>
										current.map((item, i) =>
											i === index ? value : item,
										),
									)
								}
								keyboardType="numbers-and-punctuation"
								placeholder="07:00"
								placeholderTextColor={colors.textMuted}
								style={[
									styles.input,
									styles.timeInput,
									time.length > 0 &&
										!isValidTime(time) &&
										styles.inputError,
								]}
								maxLength={5}
							/>

							<Pressable
								onPress={() =>
									setUpdateTimes((current) =>
										current.filter((_, i) => i !== index),
									)
								}
								accessibilityRole="button"
								accessibilityLabel={`Remover horário ${time || index + 1}`}
								hitSlop={8}
								style={styles.removeTimeButton}
							>
								<Ionicons
									name="trash-outline"
									size={20}
									color={colors.danger}
								/>
							</Pressable>
						</View>
					))}

					{invalidTimes && (
						<Text style={[styles.helperText, styles.errorText]}>
							Use horários válidos no formato HH:MM, sem
							duplicatas.
						</Text>
					)}

					<Pressable
						onPress={() =>
							setUpdateTimes((current) => [...current, ""])
						}
						style={({ pressed }) => [
							styles.addTimeButton,
							pressed && styles.pressed,
						]}
					>
						<Ionicons
							name="add-circle-outline"
							size={21}
							color={colors.primaryPressed}
						/>

						<Text style={styles.addTimeText}>
							Adicionar horário
						</Text>
					</Pressable>

					<PrimaryButton
						title="Salvar alterações"
						onPress={save}
						loading={saving}
						disabled={!canSave}
						style={styles.saveButton}
					/>

					<View style={styles.wifiSection}>
						<Text style={styles.sectionTitle}>Wi-Fi</Text>

						<Pressable
							onPress={openWifiConfig}
							style={({ pressed }) => [
								styles.wifiButton,
								pressed && styles.pressed,
							]}
						>
							<Ionicons
								name="wifi-outline"
								size={22}
								color={colors.primaryPressed}
							/>

							<Text style={styles.wifiButtonText}>
								Configurar Wi-Fi
							</Text>

							<Ionicons
								name="chevron-forward"
								size={20}
								color={colors.textMuted}
							/>
						</Pressable>
					</View>
				</Screen>
			</KeyboardAvoidingView>
		</>
	);
}

const styles = StyleSheet.create({
	keyboardView: {
		flex: 1,
		backgroundColor: colors.background,
	},

	screenContent: {
		flexGrow: 1,
	},

	loadingContainer: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},

	header: {
		marginBottom: spacing.lg,
	},

	pressed: {
		opacity: 0.72,
	},

	label: {
		marginTop: spacing.xl,
		marginBottom: spacing.sm,
		...typography.cardTitle,
		color: colors.text,
	},

	input: {
		minHeight: 52,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		...typography.input,
		color: colors.text,
	},

	inputError: {
		borderColor: colors.danger,
	},

	helperText: {
		marginTop: spacing.xs,
		...typography.metadata,
		color: colors.textMuted,
	},

	errorText: {
		color: colors.danger,
	},

	orientationRow: {
		flexDirection: "row",
		gap: spacing.md,
	},

	orientationCard: {
		flex: 1,
		minHeight: 64,
		paddingHorizontal: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		flexDirection: "row",
		alignItems: "center",
	},

	orientationCardSelected: {
		borderColor: colors.primary,
		backgroundColor: colors.primarySoft,
	},

	orientationSide: {
		width: 24,
		alignItems: "center",
		justifyContent: "center",
	},

	orientationContent: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
		paddingLeft: spacing.sm,
	},

	orientationText: {
		...typography.body,
		fontWeight: "600",
		color: colors.text,
	},

	orientationTextSelected: {
		color: colors.primaryPressed,
	},

	radio: {
		width: 22,
		height: 22,
		borderWidth: 2,
		borderColor: colors.textMuted,
		borderRadius: radius.pill,
		alignItems: "center",
		justifyContent: "center",
	},

	radioSelected: {
		borderColor: colors.primary,
	},

	radioDot: {
		width: 10,
		height: 10,
		borderRadius: radius.pill,
		backgroundColor: colors.primary,
	},

	scheduleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		marginTop: spacing.sm,
	},

	scheduleIcon: {
		width: 40,
		alignItems: "center",
		justifyContent: "center",
	},

	timeInput: {
		flex: 1,
	},

	removeTimeButton: {
		width: 44,
		height: 48,
		alignItems: "center",
		justifyContent: "center",
	},

	addTimeButton: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: spacing.sm,
		paddingVertical: spacing.md,
		marginTop: spacing.xs,
	},

	addTimeText: {
		...typography.body,
		fontWeight: "600",
		color: colors.primaryPressed,
	},

	saveButton: {
		marginTop: spacing.xxl,
	},

	wifiSection: {
		marginTop: spacing.xxl,
		paddingTop: spacing.xl,
		borderTopWidth: 1,
		borderTopColor: colors.border,
	},

	sectionTitle: {
		...typography.cardTitle,
		color: colors.text,
		marginBottom: spacing.sm,
	},

	wifiButton: {
		minHeight: 52,
		paddingHorizontal: spacing.lg,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
	},

	wifiButtonText: {
		flex: 1,
		...typography.body,
		fontWeight: "600",
		color: colors.text,
	},
});
