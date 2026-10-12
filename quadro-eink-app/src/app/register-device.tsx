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

import { router, Stack, useLocalSearchParams } from "expo-router";

import { Feather, Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, spacing, typography } from "@/theme";

import { createDevice } from "@/firebase/devices";

import type { DisplayType, DisplayOrientation } from "@/types/display";

type DisplayOption = {
	value: DisplayType;
	title: string;
	model: string;
	resolution: string;
	image: ImageSourcePropType;
	imageGrayscale: ImageSourcePropType;
};

type CreatedDevice = {
	name: string;
	displayType: DisplayType;
	orientation: DisplayOrientation;
	updateTimes: string[];
};

const DEFAULT_UPDATE_TIMES = ["07:00", "11:00", "21:00"];

const DISPLAY_OPTIONS: DisplayOption[] = [
	{
		value: "spectra6-7.3",
		title: '7,3" Spectra 6',
		model: "GDEP073E01",
		resolution: "800 × 480 px",
		image: require("../../assets/devices/spectra6-7.3.png"),
		imageGrayscale: require("../../assets/devices/spectra6-7.3-grayscale.png"),
	},
	{
		value: "spectra6-13.3",
		title: '13,3" Spectra 6',
		model: "GDEP133E01",
		resolution: "1600 × 1200 px",
		image: require("../../assets/devices/spectra6-13.3.png"),
		imageGrayscale: require("../../assets/devices/spectra6-13.3-grayscale.png"),
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

function isValidTime(value: string) {
	return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export default function RegisterDeviceScreen() {
	const { id, displayType, firebaseUid } = useLocalSearchParams<{
		id: string;
		displayType: DisplayType;
		firebaseUid: string;
	}>();

	const [orientation, setOrientation] =
		useState<DisplayOrientation>("portrait");

	const [name, setName] = useState("");

	const [updateTimes, setUpdateTimes] = useState<string[]>([
		...DEFAULT_UPDATE_TIMES,
	]);

	const [saving, setSaving] = useState(false);

	const [createdDevice, setCreatedDevice] = useState<CreatedDevice | null>(
		null,
	);

	const updateTime = (index: number, value: string) => {
		setUpdateTimes((current) =>
			current.map((time, i) => (i === index ? value : time)),
		);
	};

	const addUpdateTime = () => {
		setUpdateTimes((current) => [...current, ""]);
	};

	const removeUpdateTime = (index: number) => {
		setUpdateTimes((current) => current.filter((_, i) => i !== index));
	};

	const saveDevice = async () => {
		const deviceName = name.trim();

		const normalizedTimes = updateTimes.map((time) => time.trim());

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

		if (normalizedTimes.length === 0) {
			Alert.alert(
				"Horários obrigatórios",
				"Adicione pelo menos um horário de atualização.",
			);
			return;
		}

		if (normalizedTimes.some((time) => !isValidTime(time))) {
			Alert.alert(
				"Horário inválido",
				"Use o formato HH:MM, por exemplo 07:30.",
			);
			return;
		}

		if (new Set(normalizedTimes).size !== normalizedTimes.length) {
			Alert.alert(
				"Horários duplicados",
				"Cada horário deve ser diferente.",
			);
			return;
		}

		const sortedTimes = [...normalizedTimes].sort();

		try {
			setSaving(true);

			await createDevice({
				id,
				name: deviceName,
				displayType,
				orientation,
				updateTimes: sortedTimes,
				deviceAuthUid: firebaseUid,
			});

			setCreatedDevice({
				name: deviceName,
				displayType,
				orientation,
				updateTimes: sortedTimes,
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
									Atualizações:{" "}
									{createdDevice.updateTimes.join(", ")}
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
						onPress={() =>
							router.replace({
								pathname: "/",
							})
						}
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
								disabled
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
									source={
										selected
											? option.image
											: option.imageGrayscale
									}
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

				<Text style={styles.label}>Horários de atualização</Text>

				<Text style={styles.scheduleDescription}>
					Escolha os horários em que seu quadro deve sincronizar e
					atualizar a imagem.
				</Text>

				{updateTimes.map((time, index) => {
					const invalid = time.length > 0 && !isValidTime(time);

					return (
						<View key={index} style={styles.scheduleRow}>
							<Feather
								name="clock"
								size={18}
								color={colors.textSecondary}
							/>

							<TextInput
								value={time}
								onChangeText={(value) =>
									updateTime(index, value)
								}
								placeholder="HH:MM"
								placeholderTextColor={colors.textMuted}
								keyboardType="numbers-and-punctuation"
								maxLength={5}
								style={[
									styles.input,
									styles.timeInput,
									invalid && styles.inputError,
								]}
							/>

							<Pressable
								accessibilityRole="button"
								accessibilityLabel={`Remover horário ${index + 1}`}
								hitSlop={8}
								onPress={() => removeUpdateTime(index)}
								style={({ pressed }) => [
									styles.removeTimeButton,
									pressed && styles.pressed,
								]}
							>
								<Feather
									name="trash-2"
									size={19}
									color={colors.danger}
								/>
							</Pressable>
						</View>
					);
				})}

				<Pressable
					accessibilityRole="button"
					onPress={addUpdateTime}
					style={({ pressed }) => [
						styles.addTimeButton,
						pressed && styles.pressed,
					]}
				>
					<Feather name="plus" size={18} color={colors.primary} />
					<Text style={styles.addTimeText}>Adicionar horário</Text>
				</Pressable>

				<Text style={styles.helperText}>
					Os horários são definidos no formato de 24 horas.
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

	scheduleDescription: {
		marginBottom: spacing.md,
		...typography.body,
		color: colors.textSecondary,
	},

	scheduleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		marginBottom: spacing.sm,
	},

	timeInput: {
		flex: 1,
		minHeight: 48,
	},

	removeTimeButton: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
	},

	addTimeButton: {
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		gap: spacing.sm,
		paddingHorizontal: spacing.sm,
		marginTop: spacing.xs,
	},

	addTimeText: {
		...typography.body,
		fontWeight: "600",
		color: colors.primary,
	},

	helperText: {
		marginTop: spacing.xs,
		...typography.caption,
		color: colors.textMuted,
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
