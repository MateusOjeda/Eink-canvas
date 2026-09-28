import { useState } from "react";

import {
	Alert,
	Image,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
	type ImageSourcePropType,
} from "react-native";

import { router, Stack } from "expo-router";

import { Feather, Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, spacing, typography } from "@/theme";

import { createDevice } from "@/firebase/devices";

import type { DisplayType, DisplayOrientation } from "@/types/display";

import { MIN_UPDATE_INTERVAL_MINUTES } from "@/constants/constants";

type DisplayOption = {
	value: DisplayType;
	title: string;
	model: string;
	resolution: string;
	image: ImageSourcePropType;
};

type CreatedDevice = {
	name: string;
	displayType: DisplayType;
	orientation: DisplayOrientation;
	updateIntervalMinutes: number;
};

const DISPLAY_OPTIONS: DisplayOption[] = [
	{
		value: "spectra6-7.3",
		title: '7,3" Spectra 6',
		model: "GDEP073E01",
		resolution: "800 × 480 px",
		image: require("../../assets/devices/spectra6-7.3.png"),
	},
	{
		value: "spectra6-13.3",
		title: '13,3" Spectra 6',
		model: "GDEP133E01",
		resolution: "1600 × 1200 px",
		image: require("../../assets/devices/spectra6-13.3.png"),
	},
];

function getDisplayOption(displayType: DisplayType) {
	return (
		DISPLAY_OPTIONS.find((option) => option.value === displayType) ??
		DISPLAY_OPTIONS[0]
	);
}

function getOrientationLabel(orientation: DisplayOrientation) {
	return orientation === "portrait" ? "Retrato" : "Paisagem";
}

export default function RegisterDeviceScreen() {
	const [orientation, setOrientation] =
		useState<DisplayOrientation>("portrait");

	const [deviceId, setDeviceId] = useState("");
	const [name, setName] = useState("");

	const [displayType, setDisplayType] = useState<DisplayType>("spectra6-7.3");

	const [updateIntervalMinutes, setUpdateIntervalMinutes] = useState("120");

	const [saving, setSaving] = useState(false);

	const [createdDevice, setCreatedDevice] = useState<CreatedDevice | null>(
		null,
	);

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

		try {
			setSaving(true);

			await createDevice({
				id,
				name: deviceName,
				displayType,
				orientation,
				updateIntervalMinutes: interval,
			});

			setCreatedDevice({
				name: deviceName,
				displayType,
				orientation,
				updateIntervalMinutes: interval,
			});
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

	const interval = Number(updateIntervalMinutes);

	const invalidInterval =
		updateIntervalMinutes.length > 0 &&
		(!Number.isInteger(interval) || interval < MIN_UPDATE_INTERVAL_MINUTES);

	if (createdDevice) {
		const selectedDisplay = getDisplayOption(createdDevice.displayType);

		return (
			<>
				<Stack.Screen options={{ headerShown: false }} />

				<Screen scroll contentContainerStyle={styles.successScreen}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Voltar"
						hitSlop={8}
						onPress={() => router.back()}
						style={({ pressed }) => [
							styles.backButton,
							pressed && styles.pressed,
						]}
					>
						<Ionicons
							name="chevron-back"
							size={26}
							color={colors.text}
						/>
					</Pressable>

					<View style={styles.successBody}>
						<View style={styles.successIcon}>
							<Feather
								name="check"
								size={42}
								color={colors.primary}
							/>
						</View>

						<Text style={styles.successTitle}>
							Dispositivo adicionado
						</Text>

						<Text style={styles.successSubtitle}>
							Seu quadro foi cadastrado com sucesso e já pode ser
							usado.
						</Text>

						<View style={styles.deviceSummary}>
							<Image
								source={selectedDisplay.image}
								style={styles.summaryImage}
								resizeMode="contain"
							/>

							<View style={styles.summaryText}>
								<Text style={styles.summaryName}>
									{createdDevice.name}
								</Text>

								<Text style={styles.summaryMeta}>
									{selectedDisplay.title}
								</Text>

								<Text style={styles.summaryMeta}>
									{getOrientationLabel(
										createdDevice.orientation,
									)}
								</Text>

								<Text style={styles.summaryMeta}>
									Intervalo:{" "}
									{createdDevice.updateIntervalMinutes} min
								</Text>
							</View>
						</View>

						<View style={styles.nextStepCard}>
							<View style={styles.nextStepIcon}>
								<Feather
									name="wifi"
									size={22}
									color={colors.primary}
								/>
							</View>

							<View style={styles.nextStepText}>
								<Text style={styles.nextStepTitle}>
									Próximo passo
								</Text>

								<Text style={styles.nextStepDescription}>
									Para sincronizar as fotos, pressione o botão
									SYNC no seu dispositivo.
								</Text>
							</View>
						</View>
					</View>

					<PrimaryButton
						title="Concluir"
						onPress={() => router.back()}
						rightIcon={
							<Feather
								name="arrow-right"
								size={21}
								color={colors.white}
							/>
						}
					/>
				</Screen>
			</>
		);
	}

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<Screen scroll keyboardShouldPersistTaps="handled">
				<ScreenHeader
					title="Adicionar dispositivo"
					subtitle="Configure seu quadro e-ink para começar a sincronizar suas fotos."
					showBackButton
					style={styles.header}
				/>

				<Text style={styles.label}>ID do dispositivo</Text>

				<TextInput
					value={deviceId}
					onChangeText={setDeviceId}
					placeholder="Ex.: d73584a9e12b4e5c..."
					placeholderTextColor={colors.textMuted}
					autoCapitalize="none"
					autoCorrect={false}
					style={styles.input}
				/>

				<Text style={styles.label}>Nome do dispositivo</Text>

				<TextInput
					value={name}
					onChangeText={setName}
					placeholder="Ex.: Quadro da sala"
					placeholderTextColor={colors.textMuted}
					style={styles.input}
				/>

				<Text style={styles.label}>Modelo do display</Text>

				<View style={styles.modelRow}>
					{DISPLAY_OPTIONS.map((option) => {
						const selected = displayType === option.value;

						return (
							<Pressable
								key={option.value}
								onPress={() => setDisplayType(option.value)}
								style={({ pressed }) => [
									styles.modelCard,
									selected && styles.modelCardSelected,
									pressed && styles.pressed,
								]}
							>
								<View
									style={[
										styles.radio,
										styles.modelRadio,
										selected && styles.radioSelected,
									]}
								>
									{selected ? (
										<View style={styles.radioDot} />
									) : null}
								</View>

								<Image
									source={option.image}
									style={styles.modelImage}
									resizeMode="contain"
								/>

								<Text style={styles.modelTitle}>
									{option.title}
								</Text>

								<Text style={styles.modelMeta}>
									{option.model}
								</Text>

								<Text style={styles.modelMeta}>
									{option.resolution}
								</Text>
							</Pressable>
						);
					})}
				</View>

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
							<View style={styles.portraitIcon} />

							<Text style={styles.orientationText}>Retrato</Text>
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
							<View style={styles.landscapeIcon} />

							<Text style={styles.orientationText}>Paisagem</Text>
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
					style={[styles.input, invalidInterval && styles.inputError]}
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
					title="Adicionar dispositivo"
					loading={saving}
					onPress={saveDevice}
					style={styles.addButton}
					rightIcon={
						<Feather
							name="arrow-right"
							size={21}
							color={colors.white}
						/>
					}
				/>
			</Screen>
		</>
	);
}

const styles = StyleSheet.create({
	pressed: {
		opacity: 0.72,
	},

	label: {
		marginTop: spacing.lg,
		marginBottom: spacing.sm,
		...typography.body,
		fontWeight: "600",
		color: colors.text,
	},

	input: {
		minHeight: 52,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		...typography.input,
		color: colors.text,
	},

	inputError: {
		borderColor: colors.danger,
	},

	modelRow: {
		flexDirection: "row",
		gap: spacing.md,
	},

	modelCard: {
		flex: 1,
		minWidth: 0,
		padding: spacing.sm,
		paddingTop: spacing.md,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radius.lg,
		backgroundColor: colors.surface,
		alignItems: "center",
	},

	modelCardSelected: {
		borderColor: colors.primary,
		backgroundColor: colors.primarySoft,
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

	modelRadio: {
		position: "absolute",
		top: spacing.md,
		left: spacing.md,
		zIndex: 1,
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

	modelImage: {
		width: "100%",
		height: 92,
		marginTop: spacing.sm,
		marginBottom: spacing.xs,
	},

	modelTitle: {
		...typography.body,
		fontWeight: "700",
		color: colors.text,
		textAlign: "center",
	},

	modelMeta: {
		marginTop: 2,
		...typography.metadata,
		color: colors.textSecondary,
		textAlign: "center",
	},

	orientationRow: {
		flexDirection: "row",
		gap: spacing.md,
	},

	orientationCard: {
		flex: 1,
		minHeight: 58,
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
	},

	orientationText: {
		...typography.body,
		fontWeight: "600",
		color: colors.text,
	},

	portraitIcon: {
		width: 18,
		height: 27,
		borderWidth: 2,
		borderColor: colors.text,
		borderRadius: 2,
	},

	landscapeIcon: {
		marginLeft: 12,
		marginRight: -2,
		width: 28,
		height: 18,
		borderWidth: 2,
		borderColor: colors.text,
		borderRadius: 2,
	},

	helperText: {
		marginTop: spacing.xs,
		...typography.caption,
		color: colors.textMuted,
	},

	errorText: {
		color: colors.danger,
	},

	addButton: {
		marginTop: spacing.md,
	},

	successScreen: {
		flexGrow: 1,
	},

	backButton: {
		width: 44,
		height: 44,
		marginTop: -spacing.lg,
		borderRadius: radius.pill,
		backgroundColor: colors.surfaceMuted,
		alignItems: "center",
		justifyContent: "center",
	},

	successBody: {
		flex: 1,
		alignItems: "center",
		paddingTop: spacing.xxxl,
		paddingBottom: spacing.xxxl,
	},

	successIcon: {
		width: 88,
		height: 88,
		borderRadius: radius.pill,
		backgroundColor: colors.primarySoft,
		alignItems: "center",
		justifyContent: "center",
	},

	successTitle: {
		marginTop: spacing.xl,
		...typography.sectionTitle,
		color: colors.text,
		textAlign: "center",
	},

	successSubtitle: {
		marginTop: spacing.sm,
		maxWidth: 300,
		...typography.body,
		color: colors.textSecondary,
		textAlign: "center",
	},

	deviceSummary: {
		width: "100%",
		marginTop: spacing.xxxl,
		padding: spacing.lg,
		borderRadius: radius.xl,
		backgroundColor: colors.surfaceMuted,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.lg,
	},

	summaryImage: {
		width: 112,
		height: 112,
	},

	summaryText: {
		flex: 1,
		minWidth: 0,
	},

	summaryName: {
		...typography.cardTitle,
		color: colors.text,
	},

	summaryMeta: {
		marginTop: spacing.xs,
		...typography.body,
		color: colors.textSecondary,
	},

	nextStepCard: {
		width: "100%",
		marginTop: spacing.xxl,
		padding: spacing.lg,
		borderRadius: radius.xl,
		backgroundColor: colors.primarySoft,
		flexDirection: "row",
		alignItems: "flex-start",
		gap: spacing.md,
	},

	nextStepIcon: {
		width: 44,
		height: 44,
		borderRadius: radius.pill,
		backgroundColor: colors.surface,
		alignItems: "center",
		justifyContent: "center",
	},

	nextStepText: {
		flex: 1,
		minWidth: 0,
	},

	nextStepTitle: {
		...typography.cardTitle,
		color: colors.primaryPressed,
	},

	nextStepDescription: {
		marginTop: spacing.xs,
		...typography.body,
		color: colors.textSecondary,
	},

	header: {
		marginBottom: 0,
	},
});
