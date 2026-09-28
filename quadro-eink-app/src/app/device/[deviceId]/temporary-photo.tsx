import { useEffect, useState } from "react";

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

import { router, Stack, useLocalSearchParams } from "expo-router";

import { Paths } from "expo-file-system";

import { Feather, Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/layout/Screen";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

import { colors, radius, spacing, typography } from "@/theme";

import { uploadTemporaryPhoto } from "@/firebase/photos";
import { getDevice } from "@/firebase/devices";

type Recurrence = "once" | "yearly";

type YearlyDate = {
	month: number;
	day: number;
};

const MONTH_NAMES = [
	"Janeiro",
	"Fevereiro",
	"Março",
	"Abril",
	"Maio",
	"Junho",
	"Julho",
	"Agosto",
	"Setembro",
	"Outubro",
	"Novembro",
	"Dezembro",
];

function formatDuration(minutes: number): string {
	const totalHours = Math.floor(minutes / 60);
	const days = Math.floor(totalHours / 24);
	const hours = totalHours % 24;

	const parts: string[] = [];

	if (days > 0) {
		parts.push(`${days} ${days === 1 ? "dia" : "dias"}`);
	}

	if (hours > 0) {
		parts.push(`${hours} ${hours === 1 ? "hora" : "horas"}`);
	}

	return parts.join(" e ");
}

function createDefaultYearlyDate(): YearlyDate {
	const today = new Date();

	return {
		month: today.getMonth() + 1,
		day: today.getDate(),
	};
}

function getDaysInMonth(month: number): number {
	return new Date(2024, month, 0).getDate();
}

function formatYearlyDate(date: YearlyDate): string {
	return `${date.day} de ${MONTH_NAMES[date.month - 1].toLowerCase()}`;
}

export default function TemporaryPhotoScreen() {
	const {
		deviceId,

		previewFileName,
		binFileName,

		imageWidth,
		imageHeight,
	} = useLocalSearchParams<{
		deviceId: string;

		previewFileName?: string;
		binFileName?: string;

		imageWidth?: string;
		imageHeight?: string;
	}>();

	const [deviceName, setDeviceName] = useState("");

	const [recurrence, setRecurrence] = useState<Recurrence>("once");

	const [durationMinutes, setDurationMinutes] = useState<number | null>(null);

	const [yearlyDate, setYearlyDate] = useState<YearlyDate | null>(null);

	const [isDurationPickerOpen, setIsDurationPickerOpen] = useState(false);

	const [draftDurationHours, setDraftDurationHours] = useState(1);

	const [isYearlyPickerOpen, setIsYearlyPickerOpen] = useState(false);

	const [draftYearlyDate, setDraftYearlyDate] = useState<YearlyDate>(
		createDefaultYearlyDate,
	);

	const [isSending, setIsSending] = useState(false);

	const previewUri = previewFileName
		? Paths.join(Paths.cache, previewFileName)
		: null;

	const binUri = binFileName ? Paths.join(Paths.cache, binFileName) : null;

	const width = imageWidth ? Number(imageWidth) : null;
	const height = imageHeight ? Number(imageHeight) : null;

	const isPortrait = width && height ? height > width : false;

	const previewAspectRatio = width && height ? width / height : 4 / 3;

	useEffect(() => {
		const loadDevice = async () => {
			try {
				const device = await getDevice(deviceId);
				setDeviceName(device?.name ?? "");
			} catch (error) {
				console.error("Erro ao carregar o nome do quadro:", error);
			}
		};

		loadDevice();
	}, [deviceId]);

	const selectPhoto = () => {
		router.push({
			pathname: "/add-photo",

			params: {
				deviceId,
				mode: "temporary",
			},
		});
	};

	const openDurationPicker = () => {
		setDraftDurationHours(durationMinutes ? durationMinutes / 60 : 1);

		setIsDurationPickerOpen(true);
	};

	const changeDurationDays = (amount: number) => {
		setDraftDurationHours((current) => Math.max(0, current + amount * 24));
	};

	const changeDurationHours = (amount: number) => {
		setDraftDurationHours((current) => Math.max(0, current + amount));
	};

	const confirmDuration = () => {
		if (draftDurationHours <= 0) {
			Alert.alert(
				"Duração inválida",
				"Escolha uma duração de pelo menos 1 hora.",
			);

			return;
		}

		setDurationMinutes(draftDurationHours * 60);
		setIsDurationPickerOpen(false);
	};

	const openYearlyPicker = () => {
		setDraftYearlyDate(yearlyDate ?? createDefaultYearlyDate());

		setIsYearlyPickerOpen(true);
	};

	const changeYearlyMonth = (amount: number) => {
		setDraftYearlyDate((current) => {
			let month = current.month + amount;

			if (month > 12) {
				month = 1;
			}

			if (month < 1) {
				month = 12;
			}

			return {
				month,
				day: Math.min(current.day, getDaysInMonth(month)),
			};
		});
	};

	const changeYearlyDay = (amount: number) => {
		setDraftYearlyDate((current) => {
			const maxDay = getDaysInMonth(current.month);
			let day = current.day + amount;

			if (day > maxDay) {
				day = 1;
			}

			if (day < 1) {
				day = maxDay;
			}

			return {
				...current,
				day,
			};
		});
	};

	const confirmYearlyDate = () => {
		setYearlyDate({ ...draftYearlyDate });
		setIsYearlyPickerOpen(false);
	};

	const sendTemporaryPhoto = async () => {
		if (!previewUri || !binUri || !width || !height) {
			Alert.alert(
				"Foto não selecionada",
				"Selecione e processe uma foto antes de enviar.",
			);

			return;
		}

		if (recurrence === "once") {
			if (!durationMinutes || durationMinutes <= 0) {
				Alert.alert(
					"Duração não definida",
					"Escolha por quanto tempo a foto deve permanecer no quadro.",
				);

				return;
			}
		} else if (!yearlyDate) {
			Alert.alert(
				"Data não definida",
				"Escolha o dia da recorrência anual.",
			);

			return;
		}

		try {
			setIsSending(true);

			if (recurrence === "once") {
				await uploadTemporaryPhoto({
					deviceId,

					previewUri,
					binUri,

					width,
					height,

					recurrence: "once",
					durationMinutes: durationMinutes!,
				});
			} else {
				await uploadTemporaryPhoto({
					deviceId,

					previewUri,
					binUri,

					width,
					height,

					recurrence: "yearly",
					yearlyDate: yearlyDate!,
				});
			}

			Alert.alert(
				"Foto enviada",
				recurrence === "once"
					? "A foto agendada foi enviada com sucesso."
					: "A recorrência anual foi salva com sucesso.",
				[
					{
						text: "OK",
						onPress: () => {
							router.back();
						},
					},
				],
			);
		} catch (error) {
			console.error("Erro ao enviar foto agendada:", error);

			Alert.alert("Erro", "Não foi possível enviar a foto agendada.");
		} finally {
			setIsSending(false);
		}
	};

	const draftDurationDays = Math.floor(draftDurationHours / 24);

	const draftDurationRemainingHours = draftDurationHours % 24;

	const draftDurationIsValid = draftDurationHours > 0;

	const hasImage = !!previewUri && !!binUri && !!width && !!height;

	const canSend =
		hasImage &&
		(recurrence === "once"
			? !!durationMinutes && durationMinutes > 0
			: !!yearlyDate);

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />

			<Screen scroll>
				<ScreenHeader
					title="Adicionar foto agendada"
					subtitle={deviceName}
					showBackButton
				/>

				<Card padding="sm" style={styles.photoCard}>
					{previewUri ? (
						<Image
							source={{ uri: previewUri }}
							style={
								isPortrait
									? [
											styles.imageBase,
											{
												height: 250,
												aspectRatio: previewAspectRatio,
												alignSelf: "center",
											},
										]
									: [
											styles.imageBase,
											{
												width: "100%",
												aspectRatio: previewAspectRatio,
											},
										]
							}
							resizeMode="contain"
						/>
					) : (
						<View style={styles.imagePlaceholder}>
							<Ionicons
								name="image-outline"
								size={42}
								color={colors.textMuted}
							/>

							<Text style={styles.placeholderText}>
								Nenhuma imagem selecionada
							</Text>
						</View>
					)}

					<Pressable
						style={({ pressed }) => [
							styles.changePhotoButton,
							pressed && styles.pressed,
						]}
						onPress={selectPhoto}
					>
						<Feather
							name="image"
							size={20}
							color={colors.textSecondary}
						/>

						<Text style={styles.changePhotoButtonText}>
							{previewUri ? "Trocar foto" : "Selecionar foto"}
						</Text>
					</Pressable>
				</Card>

				<Text style={styles.label}>Tipo de exibição</Text>

				<View style={styles.recurrenceSelector}>
					<Pressable
						style={({ pressed }) => [
							styles.recurrenceButton,
							recurrence === "once" &&
								styles.recurrenceButtonSelected,
							pressed && styles.pressed,
						]}
						onPress={() => setRecurrence("once")}
					>
						<Feather
							name="clock"
							size={21}
							color={
								recurrence === "once"
									? colors.white
									: colors.textSecondary
							}
						/>

						<Text
							style={[
								styles.recurrenceButtonText,
								recurrence === "once" &&
									styles.recurrenceButtonTextSelected,
							]}
						>
							Por duração
						</Text>
					</Pressable>

					<Pressable
						style={({ pressed }) => [
							styles.recurrenceButton,
							recurrence === "yearly" &&
								styles.recurrenceButtonSelected,
							pressed && styles.pressed,
						]}
						onPress={() => setRecurrence("yearly")}
					>
						<Feather
							name="calendar"
							size={21}
							color={
								recurrence === "yearly"
									? colors.white
									: colors.textSecondary
							}
						/>

						<Text
							style={[
								styles.recurrenceButtonText,
								recurrence === "yearly" &&
									styles.recurrenceButtonTextSelected,
							]}
						>
							Todo ano
						</Text>
					</Pressable>
				</View>

				<Text style={styles.label}>
					{recurrence === "once" ? "Duração" : "Exibir todo ano em"}
				</Text>

				<Pressable
					onPress={
						recurrence === "once"
							? openDurationPicker
							: openYearlyPicker
					}
					style={({ pressed }) => [pressed && styles.pressed]}
				>
					<Card padding="sm" style={styles.scheduleCard}>
						<View style={styles.scheduleIcon}>
							<Feather
								name={
									recurrence === "once" ? "clock" : "calendar"
								}
								size={23}
								color={colors.textSecondary}
							/>
						</View>

						<View style={styles.scheduleText}>
							<Text style={styles.scheduleTitle}>
								{recurrence === "once"
									? durationMinutes
										? formatDuration(durationMinutes)
										: "Definir duração"
									: yearlyDate
										? formatYearlyDate(yearlyDate)
										: "Definir dia e mês"}
							</Text>

							<Text style={styles.scheduleHint}>
								{recurrence === "once"
									? "A partir da primeira exibição"
									: "Dia inteiro"}
							</Text>
						</View>

						<Feather
							name="chevron-right"
							size={22}
							color={colors.textSecondary}
						/>
					</Card>
				</Pressable>

				<View style={styles.infoBox}>
					<Feather
						name={recurrence === "once" ? "clock" : "calendar"}
						size={22}
						color={colors.textSecondary}
					/>

					<Text style={styles.infoText}>
						{recurrence === "once"
							? "Será exibida na próxima sincronização e permanecerá pelo período escolhido."
							: "Ficará ativa no dia escolhido todos os anos, durante o dia inteiro."}
					</Text>
				</View>

				<PrimaryButton
					title="Salvar foto agendada"
					disabled={!canSend}
					loading={isSending}
					onPress={sendTemporaryPhoto}
					style={styles.saveButton}
				/>
			</Screen>

			<Modal
				visible={isDurationPickerOpen}
				transparent
				animationType="fade"
				onRequestClose={() => {
					setIsDurationPickerOpen(false);
				}}
			>
				<Pressable
					style={styles.modalOverlay}
					onPress={() => {
						setIsDurationPickerOpen(false);
					}}
				>
					<Pressable
						style={styles.pickerCard}
						onPress={(event) => {
							event.stopPropagation();
						}}
					>
						<View style={styles.pickerHeader}>
							<View>
								<Text style={styles.pickerTitle}>
									Duração da foto
								</Text>

								<Text style={styles.pickerSubtitle}>
									Escolha dias e horas
								</Text>
							</View>

							<Pressable
								style={styles.closeButton}
								onPress={() => {
									setIsDurationPickerOpen(false);
								}}
							>
								<Feather name="x" size={21} color="#555555" />
							</Pressable>
						</View>

						<View style={styles.yearlySelectors}>
							<View style={styles.yearlySelectorColumn}>
								<Text style={styles.pickerLabel}>Dias</Text>

								<Pressable
									style={styles.yearlyArrow}
									onPress={() => changeDurationDays(1)}
								>
									<Feather
										name="chevron-up"
										size={23}
										color="#333333"
									/>
								</Pressable>

								<Text style={styles.yearlyDayValue}>
									{draftDurationDays}
								</Text>

								<Pressable
									style={styles.yearlyArrow}
									onPress={() => changeDurationDays(-1)}
								>
									<Feather
										name="chevron-down"
										size={23}
										color="#333333"
									/>
								</Pressable>
							</View>

							<View style={styles.yearlySelectorColumn}>
								<Text style={styles.pickerLabel}>Horas</Text>

								<Pressable
									style={styles.yearlyArrow}
									onPress={() => changeDurationHours(1)}
								>
									<Feather
										name="chevron-up"
										size={23}
										color="#333333"
									/>
								</Pressable>

								<Text style={styles.yearlyDayValue}>
									{draftDurationRemainingHours
										.toString()
										.padStart(2, "0")}
								</Text>

								<Pressable
									style={styles.yearlyArrow}
									onPress={() => changeDurationHours(-1)}
								>
									<Feather
										name="chevron-down"
										size={23}
										color="#333333"
									/>
								</Pressable>
							</View>
						</View>

						{!draftDurationIsValid && (
							<Text style={styles.invalidTimeText}>
								Escolha uma duração de pelo menos 1 hora.
							</Text>
						)}

						<Pressable
							disabled={!draftDurationIsValid}
							style={[
								styles.confirmButton,

								!draftDurationIsValid &&
									styles.confirmButtonDisabled,
							]}
							onPress={confirmDuration}
						>
							<Text style={styles.confirmButtonText}>
								Confirmar
							</Text>
						</Pressable>
					</Pressable>
				</Pressable>
			</Modal>

			<Modal
				visible={isYearlyPickerOpen}
				transparent
				animationType="fade"
				onRequestClose={() => {
					setIsYearlyPickerOpen(false);
				}}
			>
				<Pressable
					style={styles.modalOverlay}
					onPress={() => {
						setIsYearlyPickerOpen(false);
					}}
				>
					<Pressable
						style={styles.pickerCard}
						onPress={(event) => {
							event.stopPropagation();
						}}
					>
						<View style={styles.pickerHeader}>
							<View>
								<Text style={styles.pickerTitle}>
									Recorrência anual
								</Text>

								<Text style={styles.pickerSubtitle}>
									Escolha o dia e o mês
								</Text>
							</View>

							<Pressable
								style={styles.closeButton}
								onPress={() => {
									setIsYearlyPickerOpen(false);
								}}
							>
								<Feather name="x" size={21} color="#555555" />
							</Pressable>
						</View>

						<View style={styles.yearlySelectors}>
							<View style={styles.yearlySelectorColumn}>
								<Text style={styles.pickerLabel}>Mês</Text>

								<Pressable
									style={styles.yearlyArrow}
									onPress={() => changeYearlyMonth(1)}
								>
									<Feather
										name="chevron-up"
										size={23}
										color="#333333"
									/>
								</Pressable>

								<Text style={styles.yearlyMonthValue}>
									{MONTH_NAMES[draftYearlyDate.month - 1]}
								</Text>

								<Pressable
									style={styles.yearlyArrow}
									onPress={() => changeYearlyMonth(-1)}
								>
									<Feather
										name="chevron-down"
										size={23}
										color="#333333"
									/>
								</Pressable>
							</View>

							<View style={styles.yearlySelectorColumn}>
								<Text style={styles.pickerLabel}>Dia</Text>

								<Pressable
									style={styles.yearlyArrow}
									onPress={() => changeYearlyDay(1)}
								>
									<Feather
										name="chevron-up"
										size={23}
										color="#333333"
									/>
								</Pressable>

								<Text style={styles.yearlyDayValue}>
									{draftYearlyDate.day
										.toString()
										.padStart(2, "0")}
								</Text>

								<Pressable
									style={styles.yearlyArrow}
									onPress={() => changeYearlyDay(-1)}
								>
									<Feather
										name="chevron-down"
										size={23}
										color="#333333"
									/>
								</Pressable>
							</View>
						</View>

						<Pressable
							style={styles.confirmButton}
							onPress={confirmYearlyDate}
						>
							<Text style={styles.confirmButtonText}>
								Confirmar
							</Text>
						</Pressable>
					</Pressable>
				</Pressable>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	pressed: {
		opacity: 0.72,
	},

	photoCard: {
		overflow: "hidden",
	},

	imageBase: {
		borderRadius: radius.md,
		backgroundColor: colors.surface,
	},

	imagePlaceholder: {
		width: "100%",
		height: 88,
		minHeight: 200,
		borderRadius: radius.md,
		backgroundColor: colors.surfaceMuted,
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
	},

	placeholderText: {
		...typography.metadata,
		color: colors.textMuted,
	},

	changePhotoButton: {
		minHeight: 44,
		marginTop: spacing.sm,
		borderRadius: radius.md,
		backgroundColor: colors.surfaceMuted,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
	},

	changePhotoButtonText: {
		...typography.body,
		fontWeight: "600",
		color: colors.textSecondary,
	},

	label: {
		marginTop: spacing.xl,
		marginBottom: spacing.sm,
		...typography.cardTitle,
		color: colors.text,
	},

	recurrenceSelector: {
		flexDirection: "row",
		borderWidth: 1,
		borderColor: colors.borderSoft,
		borderRadius: radius.lg,
		overflow: "hidden",
		backgroundColor: colors.surface,
	},

	recurrenceButton: {
		flex: 1,
		minHeight: 50,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
		backgroundColor: colors.surface,
	},

	recurrenceButtonSelected: {
		margin: 4,
		minHeight: 42,
		borderRadius: radius.md,
		backgroundColor: colors.primary,
	},

	recurrenceButtonText: {
		...typography.body,
		fontWeight: "600",
		color: colors.textSecondary,
	},

	recurrenceButtonTextSelected: {
		color: colors.white,
	},

	scheduleCard: {
		minHeight: 74,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
	},

	scheduleIcon: {
		width: 52,
		height: 52,
		borderRadius: radius.md,
		backgroundColor: colors.surfaceMuted,
		alignItems: "center",
		justifyContent: "center",
	},

	scheduleText: {
		flex: 1,
		minWidth: 0,
	},

	scheduleTitle: {
		...typography.cardTitle,
		color: colors.text,
	},

	scheduleHint: {
		marginTop: spacing.xs,
		...typography.metadata,
		color: colors.textSecondary,
	},

	infoBox: {
		marginTop: spacing.lg,
		padding: spacing.lg,
		borderRadius: radius.lg,
		backgroundColor: colors.surfaceMuted,
		flexDirection: "row",
		alignItems: "flex-start",
		gap: spacing.md,
	},

	infoText: {
		flex: 1,
		...typography.body,
		color: colors.textSecondary,
	},

	saveButton: {
		marginTop: spacing.xxl,
	},

	modalOverlay: {
		flex: 1,

		backgroundColor: "rgba(0, 0, 0, 0.35)",

		justifyContent: "center",

		padding: 24,
	},

	pickerCard: {
		backgroundColor: colors.surface,

		borderRadius: 18,

		padding: 20,
	},

	pickerHeader: {
		flexDirection: "row",

		alignItems: "flex-start",

		justifyContent: "space-between",

		marginBottom: 20,
	},

	pickerTitle: {
		fontSize: 20,

		fontWeight: "700",

		color: "#111111",
	},

	pickerSubtitle: {
		marginTop: 4,

		fontSize: 13,

		color: colors.textSecondary,
	},

	closeButton: {
		width: 36,

		height: 36,

		alignItems: "center",

		justifyContent: "center",

		borderRadius: 18,

		backgroundColor: colors.surfaceMuted,
	},

	quickDates: {
		flexDirection: "row",

		gap: 10,

		marginBottom: 20,
	},

	quickDateButton: {
		flex: 1,

		paddingVertical: 10,

		borderWidth: 1,

		borderColor: colors.border,

		borderRadius: 10,

		alignItems: "center",
	},

	quickDateButtonSelected: {
		backgroundColor: colors.primary,

		borderColor: colors.primary,
	},

	quickDateText: {
		fontSize: 14,

		fontWeight: "600",

		color: colors.textSecondary,
	},

	quickDateTextSelected: {
		color: colors.white,
	},

	pickerLabel: {
		fontSize: 13,

		fontWeight: "600",

		color: colors.textSecondary,

		marginBottom: 8,
	},

	dateSelector: {
		height: 70,

		flexDirection: "row",

		alignItems: "center",

		borderWidth: 1,

		borderColor: colors.border,

		borderRadius: 12,

		marginBottom: 22,
	},

	selectorArrow: {
		width: 54,

		height: "100%",

		alignItems: "center",

		justifyContent: "center",
	},

	selectorArrowDisabled: {
		opacity: 0.4,
	},

	selectedDate: {
		flex: 1,

		alignItems: "center",

		justifyContent: "center",
	},

	selectedDateTitle: {
		fontSize: 16,

		fontWeight: "600",

		color: "#111111",
	},

	selectedDateValue: {
		marginTop: 3,

		fontSize: 12,

		color: "#888888",
	},

	timeSelector: {
		flexDirection: "row",

		justifyContent: "center",

		alignItems: "center",

		marginTop: 2,

		marginBottom: 10,
	},

	timeUnit: {
		width: 86,

		alignItems: "center",
	},

	timeArrow: {
		width: 54,

		height: 38,

		alignItems: "center",

		justifyContent: "center",
	},

	timeValue: {
		width: 74,

		paddingVertical: 10,

		borderWidth: 1,

		borderColor: colors.border,

		borderRadius: 10,

		textAlign: "center",

		fontSize: 28,

		fontWeight: "600",

		color: "#111111",

		fontVariant: ["tabular-nums"],
	},

	timeSeparator: {
		marginHorizontal: 7,

		fontSize: 28,

		fontWeight: "600",

		color: colors.textSecondary,
	},

	invalidTimeText: {
		marginTop: 4,

		textAlign: "center",

		fontSize: 12,

		color: "#b00020",
	},

	yearlySelectors: {
		flexDirection: "row",

		gap: 14,

		marginTop: 4,
	},

	yearlySelectorColumn: {
		flex: 1,

		alignItems: "center",
	},

	yearlyArrow: {
		width: "100%",

		height: 40,

		alignItems: "center",
		justifyContent: "center",
	},

	yearlyMonthValue: {
		width: "100%",

		paddingVertical: 14,

		borderWidth: 1,
		borderColor: colors.border,

		borderRadius: 10,

		textAlign: "center",

		fontSize: 17,
		fontWeight: "600",

		color: "#111111",
	},

	yearlyDayValue: {
		width: "100%",

		paddingVertical: 9,

		borderWidth: 1,
		borderColor: colors.border,

		borderRadius: 10,

		textAlign: "center",

		fontSize: 28,
		fontWeight: "600",

		color: "#111111",

		fontVariant: ["tabular-nums"],
	},

	confirmButton: {
		marginTop: 18,

		backgroundColor: colors.primary,

		borderRadius: 12,

		paddingVertical: 14,

		alignItems: "center",
	},

	confirmButtonDisabled: {
		backgroundColor: colors.disabled,
	},

	confirmButtonText: {
		color: colors.white,

		fontSize: 16,

		fontWeight: "600",
	},
});
