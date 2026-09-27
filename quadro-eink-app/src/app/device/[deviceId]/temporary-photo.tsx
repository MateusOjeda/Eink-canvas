import { useState } from "react";

import {
	ActivityIndicator,
	Alert,
	Image,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";

import { router, useLocalSearchParams } from "expo-router";

import { Paths } from "expo-file-system";

import { Feather, Ionicons } from "@expo/vector-icons";

import { uploadTemporaryPhoto } from "@/firebase/photos";

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
		setDraftDurationHours(
			durationMinutes ? durationMinutes / 60 : 1,
		);

		setIsDurationPickerOpen(true);
	};

	const changeDurationDays = (amount: number) => {
		setDraftDurationHours((current) =>
			Math.max(0, current + amount * 24),
		);
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
			<ScrollView
				style={styles.container}
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
			>
				{previewUri ? (
					<View style={styles.imageContainer}>
						<Image
							source={{
								uri: previewUri,
							}}
							style={styles.image}
							resizeMode="contain"
						/>
					</View>
				) : (
					<View style={styles.imagePlaceholder}>
						<Ionicons
							name="image-outline"
							size={42}
							color="#888888"
						/>

						<Text style={styles.placeholderText}>
							Nenhuma imagem selecionada
						</Text>
					</View>
				)}

				<Pressable style={styles.secondaryButton} onPress={selectPhoto}>
					<Feather name="image" size={19} color="#222222" />

					<Text style={styles.secondaryButtonText}>
						{previewUri
							? "Selecionar outra foto"
							: "Selecionar foto"}
					</Text>
				</Pressable>

				<Text style={styles.label}>Tipo de exibição</Text>

				<View style={styles.recurrenceSelector}>
					<Pressable
						style={[
							styles.recurrenceButton,

							recurrence === "once" &&
								styles.recurrenceButtonSelected,
						]}
						onPress={() => setRecurrence("once")}
					>
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
						style={[
							styles.recurrenceButton,

							recurrence === "yearly" &&
								styles.recurrenceButtonSelected,
						]}
						onPress={() => setRecurrence("yearly")}
					>
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

				<View style={styles.infoBox}>
					<Feather
						name={recurrence === "once" ? "clock" : "repeat"}
						size={19}
						color="#666666"
					/>

					<Text style={styles.infoText}>
						{recurrence === "once"
							? "A foto será exibida na próxima sincronização do quadro e permanecerá pelo tempo escolhido a partir do momento em que for exibida."
							: "A foto ficará ativa no dia escolhido todos os anos, das 00:00 às 23:59 no fuso local do quadro."}
					</Text>
				</View>

				{recurrence === "once" ? (
					<>
						<Text style={styles.label}>Duração</Text>

						<Pressable
							style={styles.dateButton}
							onPress={openDurationPicker}
						>
							<View>
								<Text style={styles.datePlaceholder}>
									{durationMinutes
										? formatDuration(durationMinutes)
										: "Definir duração"}
								</Text>

								<Text style={styles.dateHint}>
									A partir da primeira exibição
								</Text>
							</View>

							<Feather
								name="chevron-right"
								size={20}
								color="#777777"
							/>
						</Pressable>
					</>
				) : (
					<>
						<Text style={styles.label}>Exibir todo ano em</Text>

						<Pressable
							style={styles.dateButton}
							onPress={openYearlyPicker}
						>
							<View>
								<Text style={styles.datePlaceholder}>
									{yearlyDate
										? formatYearlyDate(yearlyDate)
										: "Definir dia e mês"}
								</Text>

								<Text style={styles.dateHint}>Dia inteiro</Text>
							</View>

							<Feather
								name="chevron-right"
								size={20}
								color="#777777"
							/>
						</Pressable>
					</>
				)}

				<View style={styles.rules}>
					<Text style={styles.rulesTitle}>Como vai funcionar</Text>

					<Text style={styles.rule}>
						• SYNC faz o quadro buscar as alterações imediatamente.
					</Text>

					{recurrence === "once" ? (
						<>
							<Text style={styles.rule}>
								• NEXT descarta a foto agendada antes do fim da
								duração.
							</Text>

							<Text style={styles.rule}>
								• Após o tempo escolhido, a foto deixa de ser exibida
								e não fica no histórico.
							</Text>
						</>
					) : (
						<Text style={styles.rule}>
							• A foto fica ativa somente no dia escolhido, todos
							os anos.
						</Text>
					)}
				</View>

				<Pressable
					disabled={!canSend || isSending}
					style={[
						styles.sendButton,

						(!canSend || isSending) && styles.sendButtonDisabled,
					]}
					onPress={sendTemporaryPhoto}
				>
					{isSending ? (
						<ActivityIndicator color="#ffffff" />
					) : (
						<Text style={styles.sendButtonText}>
							{recurrence === "once"
								? "Enviar foto agendada"
								: "Enviar recorrência anual"}
						</Text>
					)}
				</Pressable>
			</ScrollView>

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
	container: {
		flex: 1,

		backgroundColor: "#ffffff",
	},

	content: {
		padding: 24,
		paddingBottom: 32,
	},

	imagePlaceholder: {
		height: 220,

		borderWidth: 1,
		borderColor: "#dddddd",

		borderRadius: 12,

		backgroundColor: "#f7f7f7",

		alignItems: "center",

		justifyContent: "center",

		gap: 10,
	},

	imageContainer: {
		height: 220,

		borderWidth: 1,
		borderColor: "#dddddd",

		borderRadius: 12,

		backgroundColor: "#f7f7f7",

		overflow: "hidden",
	},

	image: {
		width: "100%",
		height: "100%",
	},

	placeholderText: {
		fontSize: 14,

		color: "#777777",
	},

	secondaryButton: {
		marginTop: 12,

		height: 48,

		borderWidth: 1,
		borderColor: "#dddddd",

		borderRadius: 12,

		flexDirection: "row",

		alignItems: "center",

		justifyContent: "center",

		gap: 8,
	},

	secondaryButtonText: {
		fontSize: 15,

		fontWeight: "600",

		color: "#222222",
	},

	infoBox: {
		marginTop: 24,

		flexDirection: "row",

		alignItems: "flex-start",

		gap: 10,

		padding: 14,

		borderRadius: 12,

		backgroundColor: "#f5f5f5",
	},

	infoText: {
		flex: 1,

		fontSize: 14,

		lineHeight: 20,

		color: "#555555",
	},

	label: {
		marginTop: 24,

		marginBottom: 8,

		fontSize: 15,

		fontWeight: "600",
	},

	recurrenceSelector: {
		flexDirection: "row",

		gap: 10,
	},

	recurrenceButton: {
		flex: 1,

		paddingVertical: 12,

		borderWidth: 1,
		borderColor: "#dddddd",

		borderRadius: 10,

		alignItems: "center",
	},

	recurrenceButtonSelected: {
		backgroundColor: "#111111",

		borderColor: "#111111",
	},

	recurrenceButtonText: {
		fontSize: 14,

		fontWeight: "600",

		color: "#444444",
	},

	recurrenceButtonTextSelected: {
		color: "#ffffff",
	},

	dateButton: {
		borderWidth: 1,

		borderColor: "#dddddd",

		borderRadius: 12,

		padding: 15,

		flexDirection: "row",

		alignItems: "center",

		justifyContent: "space-between",
	},

	datePlaceholder: {
		fontSize: 15,

		fontWeight: "500",
	},

	dateHint: {
		marginTop: 3,

		fontSize: 12,

		color: "#888888",
	},

	rules: {
		marginTop: 26,

		gap: 7,
	},

	rulesTitle: {
		marginBottom: 3,

		fontSize: 15,

		fontWeight: "600",
	},

	rule: {
		fontSize: 13,

		lineHeight: 19,

		color: "#666666",
	},

	sendButton: {
		marginTop: 28,

		backgroundColor: "#111111",

		borderRadius: 12,

		paddingVertical: 14,

		alignItems: "center",

		minHeight: 48,

		justifyContent: "center",
	},

	sendButtonDisabled: {
		backgroundColor: "#bdbdbd",
	},

	sendButtonText: {
		color: "#ffffff",

		fontSize: 16,

		fontWeight: "600",
	},

	modalOverlay: {
		flex: 1,

		backgroundColor: "rgba(0, 0, 0, 0.35)",

		justifyContent: "center",

		padding: 24,
	},

	pickerCard: {
		backgroundColor: "#ffffff",

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

		color: "#777777",
	},

	closeButton: {
		width: 36,

		height: 36,

		alignItems: "center",

		justifyContent: "center",

		borderRadius: 18,

		backgroundColor: "#f3f3f3",
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

		borderColor: "#dddddd",

		borderRadius: 10,

		alignItems: "center",
	},

	quickDateButtonSelected: {
		backgroundColor: "#111111",

		borderColor: "#111111",
	},

	quickDateText: {
		fontSize: 14,

		fontWeight: "600",

		color: "#444444",
	},

	quickDateTextSelected: {
		color: "#ffffff",
	},

	pickerLabel: {
		fontSize: 13,

		fontWeight: "600",

		color: "#666666",

		marginBottom: 8,
	},

	dateSelector: {
		height: 70,

		flexDirection: "row",

		alignItems: "center",

		borderWidth: 1,

		borderColor: "#dddddd",

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

		borderColor: "#dddddd",

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

		color: "#444444",
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
		borderColor: "#dddddd",

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
		borderColor: "#dddddd",

		borderRadius: 10,

		textAlign: "center",

		fontSize: 28,
		fontWeight: "600",

		color: "#111111",

		fontVariant: ["tabular-nums"],
	},

	confirmButton: {
		marginTop: 18,

		backgroundColor: "#111111",

		borderRadius: 12,

		paddingVertical: 14,

		alignItems: "center",
	},

	confirmButtonDisabled: {
		backgroundColor: "#bdbdbd",
	},

	confirmButtonText: {
		color: "#ffffff",

		fontSize: 16,

		fontWeight: "600",
	},
});
