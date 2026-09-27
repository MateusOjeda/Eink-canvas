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

const MINUTE_STEP = 5;

function createDefaultExpiration(): Date {
	const date = new Date();

	date.setHours(date.getHours() + 1);

	const minutes = Math.ceil(date.getMinutes() / MINUTE_STEP) * MINUTE_STEP;

	date.setMinutes(minutes, 0, 0);

	return date;
}

function startOfDay(date: Date): Date {
	const result = new Date(date);

	result.setHours(0, 0, 0, 0);

	return result;
}

function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function getDateLabel(date: Date): string {
	const today = new Date();

	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);

	if (isSameDay(date, today)) {
		return "Hoje";
	}

	if (isSameDay(date, tomorrow)) {
		return "Amanhã";
	}

	const value = date.toLocaleDateString("pt-BR", {
		weekday: "long",
	});

	return value.charAt(0).toUpperCase() + value.slice(1);
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

	const [expiresAt, setExpiresAt] = useState<Date | null>(null);

	const [yearlyDate, setYearlyDate] = useState<YearlyDate | null>(null);

	const [isPickerOpen, setIsPickerOpen] = useState(false);

	const [draftExpiresAt, setDraftExpiresAt] = useState<Date>(
		createDefaultExpiration,
	);

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

	const openExpirationPicker = () => {
		setDraftExpiresAt(
			expiresAt ? new Date(expiresAt) : createDefaultExpiration(),
		);

		setIsPickerOpen(true);
	};

	const selectToday = () => {
		const today = new Date();

		const next = new Date(draftExpiresAt);

		next.setFullYear(
			today.getFullYear(),
			today.getMonth(),
			today.getDate(),
		);

		setDraftExpiresAt(next);
	};

	const selectTomorrow = () => {
		const tomorrow = new Date();

		tomorrow.setDate(tomorrow.getDate() + 1);

		const next = new Date(draftExpiresAt);

		next.setFullYear(
			tomorrow.getFullYear(),
			tomorrow.getMonth(),
			tomorrow.getDate(),
		);

		setDraftExpiresAt(next);
	};

	const changeDay = (amount: number) => {
		const next = new Date(draftExpiresAt);

		next.setDate(next.getDate() + amount);

		if (startOfDay(next).getTime() < startOfDay(new Date()).getTime()) {
			return;
		}

		setDraftExpiresAt(next);
	};

	const changeHour = (amount: number) => {
		const next = new Date(draftExpiresAt);

		next.setHours(next.getHours() + amount);

		if (startOfDay(next).getTime() < startOfDay(new Date()).getTime()) {
			return;
		}

		setDraftExpiresAt(next);
	};

	const changeMinute = (amount: number) => {
		const next = new Date(draftExpiresAt);

		next.setMinutes(next.getMinutes() + amount);

		if (startOfDay(next).getTime() < startOfDay(new Date()).getTime()) {
			return;
		}

		setDraftExpiresAt(next);
	};

	const confirmExpiration = () => {
		if (draftExpiresAt.getTime() <= Date.now()) {
			Alert.alert(
				"Horário inválido",
				"Escolha uma data e um horário no futuro.",
			);

			return;
		}

		setExpiresAt(new Date(draftExpiresAt));

		setIsPickerOpen(false);
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
			if (!expiresAt) {
				Alert.alert(
					"Horário não definido",
					"Escolha até quando a foto deve permanecer no quadro.",
				);

				return;
			}

			if (expiresAt.getTime() <= Date.now()) {
				Alert.alert(
					"Horário inválido",
					"Escolha uma data e um horário no futuro.",
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
					expiresAt: expiresAt!,
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
					? "A foto temporária foi enviada com sucesso."
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
			console.error("Erro ao enviar foto temporária:", error);

			Alert.alert("Erro", "Não foi possível enviar a foto temporária.");
		} finally {
			setIsSending(false);
		}
	};

	const previousDayDisabled =
		startOfDay(draftExpiresAt).getTime() <=
		startOfDay(new Date()).getTime();

	const draftIsValid = draftExpiresAt.getTime() > Date.now();

	const hasImage = !!previewUri && !!binUri && !!width && !!height;

	const canSend =
		hasImage &&
		(recurrence === "once"
			? !!expiresAt && expiresAt.getTime() > Date.now()
			: !!yearlyDate);

	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);

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
							Até uma data
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
							? "A foto será exibida na próxima sincronização do quadro e permanecerá até o horário escolhido."
							: "A foto ficará ativa no dia escolhido todos os anos, das 00:00 às 23:59 no fuso local do quadro."}
					</Text>
				</View>

				{recurrence === "once" ? (
					<>
						<Text style={styles.label}>Exibir até</Text>

						<Pressable
							style={styles.dateButton}
							onPress={openExpirationPicker}
						>
							<View>
								<Text style={styles.datePlaceholder}>
									{expiresAt
										? expiresAt.toLocaleDateString("pt-BR")
										: "Definir data e hora"}
								</Text>

								<Text style={styles.dateHint}>
									{expiresAt
										? expiresAt.toLocaleTimeString(
												"pt-BR",
												{
													hour: "2-digit",
													minute: "2-digit",
												},
											)
										: "Ainda não definido"}
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
								• NEXT descarta a foto temporária antes do
								vencimento.
							</Text>

							<Text style={styles.rule}>
								• Após expirar, a foto é removida e não fica no
								histórico.
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
								? "Enviar foto temporária"
								: "Enviar recorrência anual"}
						</Text>
					)}
				</Pressable>
			</ScrollView>

			<Modal
				visible={isPickerOpen}
				transparent
				animationType="fade"
				onRequestClose={() => {
					setIsPickerOpen(false);
				}}
			>
				<Pressable
					style={styles.modalOverlay}
					onPress={() => {
						setIsPickerOpen(false);
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
									Exibir foto até
								</Text>

								<Text style={styles.pickerSubtitle}>
									Escolha a data e o horário
								</Text>
							</View>

							<Pressable
								style={styles.closeButton}
								onPress={() => {
									setIsPickerOpen(false);
								}}
							>
								<Feather name="x" size={21} color="#555555" />
							</Pressable>
						</View>

						<View style={styles.quickDates}>
							<Pressable
								style={[
									styles.quickDateButton,

									isSameDay(draftExpiresAt, new Date()) &&
										styles.quickDateButtonSelected,
								]}
								onPress={selectToday}
							>
								<Text
									style={[
										styles.quickDateText,

										isSameDay(draftExpiresAt, new Date()) &&
											styles.quickDateTextSelected,
									]}
								>
									Hoje
								</Text>
							</Pressable>

							<Pressable
								style={[
									styles.quickDateButton,

									isSameDay(draftExpiresAt, tomorrow) &&
										styles.quickDateButtonSelected,
								]}
								onPress={selectTomorrow}
							>
								<Text
									style={[
										styles.quickDateText,

										isSameDay(draftExpiresAt, tomorrow) &&
											styles.quickDateTextSelected,
									]}
								>
									Amanhã
								</Text>
							</Pressable>
						</View>

						<Text style={styles.pickerLabel}>Data</Text>

						<View style={styles.dateSelector}>
							<Pressable
								disabled={previousDayDisabled}
								style={[
									styles.selectorArrow,

									previousDayDisabled &&
										styles.selectorArrowDisabled,
								]}
								onPress={() => {
									changeDay(-1);
								}}
							>
								<Feather
									name="chevron-left"
									size={22}
									color={
										previousDayDisabled
											? "#cccccc"
											: "#333333"
									}
								/>
							</Pressable>

							<View style={styles.selectedDate}>
								<Text style={styles.selectedDateTitle}>
									{getDateLabel(draftExpiresAt)}
								</Text>

								<Text style={styles.selectedDateValue}>
									{draftExpiresAt.toLocaleDateString("pt-BR")}
								</Text>
							</View>

							<Pressable
								style={styles.selectorArrow}
								onPress={() => {
									changeDay(1);
								}}
							>
								<Feather
									name="chevron-right"
									size={22}
									color="#333333"
								/>
							</Pressable>
						</View>

						<Text style={styles.pickerLabel}>Horário</Text>

						<View style={styles.timeSelector}>
							<View style={styles.timeUnit}>
								<Pressable
									style={styles.timeArrow}
									onPress={() => {
										changeHour(1);
									}}
								>
									<Feather
										name="chevron-up"
										size={23}
										color="#333333"
									/>
								</Pressable>

								<Text style={styles.timeValue}>
									{draftExpiresAt
										.getHours()
										.toString()
										.padStart(2, "0")}
								</Text>

								<Pressable
									style={styles.timeArrow}
									onPress={() => {
										changeHour(-1);
									}}
								>
									<Feather
										name="chevron-down"
										size={23}
										color="#333333"
									/>
								</Pressable>
							</View>

							<Text style={styles.timeSeparator}>:</Text>

							<View style={styles.timeUnit}>
								<Pressable
									style={styles.timeArrow}
									onPress={() => {
										changeMinute(MINUTE_STEP);
									}}
								>
									<Feather
										name="chevron-up"
										size={23}
										color="#333333"
									/>
								</Pressable>

								<Text style={styles.timeValue}>
									{draftExpiresAt
										.getMinutes()
										.toString()
										.padStart(2, "0")}
								</Text>

								<Pressable
									style={styles.timeArrow}
									onPress={() => {
										changeMinute(-MINUTE_STEP);
									}}
								>
									<Feather
										name="chevron-down"
										size={23}
										color="#333333"
									/>
								</Pressable>
							</View>
						</View>

						{!draftIsValid && (
							<Text style={styles.invalidTimeText}>
								Escolha um horário no futuro.
							</Text>
						)}

						<Pressable
							disabled={!draftIsValid}
							style={[
								styles.confirmButton,

								!draftIsValid && styles.confirmButtonDisabled,
							]}
							onPress={confirmExpiration}
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
