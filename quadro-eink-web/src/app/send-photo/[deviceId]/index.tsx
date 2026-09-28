import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
} from "react-native";

import { router } from "expo-router";

import { Feather } from "@expo/vector-icons";

import { useSendPhotoFlow } from "../../../contexts/SendPhotoFlowContext";

import {
	getDisplayName,
	getOrientationName,
} from "../../../utils/web-photo-flow";

export default function PickPhotoScreen() {
	const { width, height } = useWindowDimensions();

	const compact = width < 420;
	const short = height < 720;

	const { device, deviceLoading, deviceError, pickImage } =
		useSendPhotoFlow();

	if (deviceLoading) {
		return (
			<View style={styles.centerContainer}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (!device || deviceError) {
		return (
			<View style={styles.centerContainer}>
				<View style={styles.card}>
					<Text style={styles.title}>Erro</Text>

					<Text style={styles.description}>
						{deviceError ?? "Quadro não encontrado."}
					</Text>

					<Pressable
						style={styles.secondaryButton}
						onPress={() => router.replace("/")}
					>
						<Text style={styles.secondaryButtonText}>Voltar</Text>
					</Pressable>
				</View>
			</View>
		);
	}

	const choosePhoto = async () => {
		const selected = await pickImage();

		if (!selected) {
			return;
		}

		router.push({
			pathname: "/send-photo/[deviceId]/crop",
			params: {
				deviceId: device.id,
			},
		});
	};

	return (
		<View style={[styles.screen, compact && styles.screenCompact]}>
			<View style={[styles.card, compact && styles.cardCompact]}>
				<View style={styles.headerRow}>
					<Pressable
						style={({ pressed }) => [
							styles.backButton,
							pressed && styles.pressed,
						]}
						hitSlop={10}
						onPress={() => router.back()}
					>
						<Feather name="arrow-left" size={26} color="#4A4F54" />
					</Pressable>

					<Text
						style={[styles.title, compact && styles.titleCompact]}
					>
						Enviar foto
					</Text>
				</View>

				<Text
					style={[
						styles.description,
						compact && styles.descriptionCompact,
					]}
				>
					Envie uma foto agendada para{" "}
					<Text style={styles.descriptionStrong}>{device.name}</Text>.
				</Text>

				<View
					style={[
						styles.deviceSummary,
						compact && styles.deviceSummaryCompact,
					]}
				>
					<View style={styles.summaryColumn}>
						<Text style={styles.summaryLabel}>Display</Text>

						<Text style={styles.summaryValue} numberOfLines={1}>
							{getDisplayName(device)}
						</Text>
					</View>

					<View style={styles.summaryDivider} />

					<View style={styles.summaryColumn}>
						<Text style={styles.summaryLabel}>Orientação</Text>

						<Text style={styles.summaryValue}>
							{getOrientationName(device)}
						</Text>
					</View>
				</View>

				<View style={styles.imagePlaceholderOuter}>
					<View style={styles.imagePlaceholder}>
						<Feather name="image" size={40} color="#777F88" />

						<Text style={styles.imagePlaceholderTitle}>
							Nenhuma foto selecionada
						</Text>

						<Text style={styles.imagePlaceholderText}>
							Escolha uma foto para enviar ao quadro.
						</Text>
					</View>
				</View>

				<Pressable
					style={({ pressed }) => [
						styles.primaryButton,
						pressed && styles.primaryButtonPressed,
					]}
					onPress={choosePhoto}
				>
					<Text style={styles.primaryButtonText}>Escolher foto</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: "#FAF9F7",
		paddingHorizontal: 16,
		paddingVertical: 14,
		alignItems: "center",
	},

	screenCompact: {
		paddingHorizontal: 10,
		paddingVertical: 10,
	},

	centerContainer: {
		flex: 1,
		backgroundColor: "#FAF9F7",
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},

	card: {
		flex: 1,
		width: "100%",
		maxWidth: 720,
		backgroundColor: "#FFFFFF",

		borderRadius: 24,

		paddingHorizontal: 24,
		paddingTop: 14,
		paddingBottom: 12,

		shadowColor: "#000000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.06,
		shadowRadius: 8,

		elevation: 2,
	},

	cardCompact: {
		borderRadius: 20,
		paddingHorizontal: 14,
		paddingTop: 12,
		paddingBottom: 10,
	},

	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},

	backButton: {
		width: 32,
		height: 34,
		alignItems: "flex-start",
		justifyContent: "center",
	},

	title: {
		fontSize: 30,
		lineHeight: 36,
		fontWeight: "700",
		color: "#1A1A1A",
	},

	titleCompact: {
		fontSize: 24,
		lineHeight: 30,
	},

	description: {
		marginTop: 2,
		marginBottom: 6,

		fontSize: 15,
		lineHeight: 21,
		color: "#666666",
	},

	descriptionCompact: {
		marginBottom: 6,
	},

	descriptionStrong: {
		fontWeight: "700",
		color: "#1A1A1A",
	},

	deviceSummary: {
		minHeight: 62,

		borderWidth: 1,
		borderColor: "#EEEEEEEE",
		borderRadius: 12,

		backgroundColor: "#FFFFFF",

		flexDirection: "row",
		alignItems: "center",

		paddingHorizontal: 16,
		paddingVertical: 8,

		marginBottom: 8,
	},

	deviceSummaryCompact: {
		minHeight: 66,

		paddingHorizontal: 14,
		paddingVertical: 9,

		marginBottom: 9,
	},

	summaryColumn: {
		flex: 1,
	},

	summaryDivider: {
		width: StyleSheet.hairlineWidth,
		height: "70%",
		backgroundColor: "#EEEEEEEE",
		marginHorizontal: 12,
	},

	summaryLabel: {
		fontSize: 13,
		lineHeight: 18,
		color: "#888888",
	},

	summaryValue: {
		marginTop: 2,
		fontSize: 16,
		lineHeight: 21,
		fontWeight: "600",
		color: "#1A1A1A",
	},

	imagePlaceholderOuter: {
		flex: 1,
		minHeight: 0,

		borderWidth: 1,
		borderColor: "#EEEEEE",
		borderRadius: 14,

		padding: 8,
		backgroundColor: "#FFFFFF",

		marginTop: 4,
		marginBottom: 12,
	},

	imagePlaceholder: {
		flex: 1,

		borderWidth: 1,
		borderStyle: "dashed",
		borderColor: "#EEEEEEEE",
		borderRadius: 12,

		backgroundColor: "#F4F5F4",

		alignItems: "center",
		justifyContent: "center",

		paddingHorizontal: 20,
	},

	imagePlaceholderTitle: {
		marginTop: 12,

		fontSize: 18,
		lineHeight: 24,
		fontWeight: "600",

		color: "#666666",
		textAlign: "center",
	},

	imagePlaceholderText: {
		marginTop: 5,

		fontSize: 15,
		lineHeight: 21,

		color: "#888888",
		textAlign: "center",
	},

	primaryButton: {
		minHeight: 48,

		paddingHorizontal: 16,
		paddingVertical: 12,

		borderRadius: 12,

		backgroundColor: "#668882",

		alignItems: "center",
		justifyContent: "center",
	},

	primaryButtonPressed: {
		backgroundColor: "#4e6863",
	},

	primaryButtonText: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: "600",

		color: "#FFFFFF",
		textAlign: "center",
	},

	secondaryButton: {
		minHeight: 48,

		paddingHorizontal: 16,
		paddingVertical: 12,

		borderWidth: 1,
		borderColor: "#EEEEEEEE",
		borderRadius: 12,

		backgroundColor: "#FFFFFF",

		alignItems: "center",
		justifyContent: "center",
	},

	secondaryButtonText: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: "600",
		color: "#666666",
	},

	pressed: {
		opacity: 0.72,
	},
});
