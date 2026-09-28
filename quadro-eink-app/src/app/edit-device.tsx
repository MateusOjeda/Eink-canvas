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

import { MIN_UPDATE_INTERVAL_MINUTES } from "@/constants/constants";

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

	const interval = Number(updateIntervalMinutes);

	const invalidInterval =
		updateIntervalMinutes.length > 0 &&
		(!Number.isInteger(interval) || interval < MIN_UPDATE_INTERVAL_MINUTES);

	const canSave =
		Boolean(name.trim()) &&
		!invalidInterval &&
		updateIntervalMinutes.length > 0 &&
		!saving;

	const save = async () => {
		const trimmedName = name.trim();

		const parsedInterval = Number(updateIntervalMinutes);

		if (
			!Number.isInteger(parsedInterval) ||
			parsedInterval < MIN_UPDATE_INTERVAL_MINUTES
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

		try {
			setSaving(true);

			await updateDevice(deviceId, {
				name: trimmedName,
				orientation,
				updateIntervalMinutes: parsedInterval,
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

					<Text style={styles.label}>
						Intervalo entre fotos (minutos)
					</Text>

					<TextInput
						value={updateIntervalMinutes}
						onChangeText={setUpdateIntervalMinutes}
						keyboardType="number-pad"
						placeholder="120"
						placeholderTextColor={colors.textMuted}
						style={[
							styles.input,
							invalidInterval && styles.inputError,
						]}
					/>

					<Text
						style={[
							styles.helperText,
							invalidInterval && styles.errorText,
						]}
					>
						{invalidInterval
							? `O mínimo é ${MIN_UPDATE_INTERVAL_MINUTES} minutos.`
							: `Mínimo: ${MIN_UPDATE_INTERVAL_MINUTES} min`}
					</Text>

					<PrimaryButton
						title="Salvar alterações"
						onPress={save}
						loading={saving}
						disabled={!canSave}
						style={styles.saveButton}
					/>
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

	saveButton: {
		marginTop: spacing.xxl,
	},
});
