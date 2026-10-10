import {
	Pressable,
	StyleSheet,
	Text,
	useWindowDimensions,
	View,
	Image,
} from "react-native";

import { router } from "expo-router";

import { Feather } from "@expo/vector-icons";

import { useSendPhotoFlow } from "../../../contexts/SendPhotoFlowContext";

export default function SuccessScreen() {
	const { width } = useWindowDimensions();

	const compact = width < 420;

	const { device, resetAll } = useSendPhotoFlow();

	const finish = () => {
		router.replace("/");
	};

	return (
		<View style={[styles.screen, compact && styles.screenCompact]}>
			<View style={[styles.card, compact && styles.cardCompact]}>
				<View style={styles.content}>
					<View style={styles.successIcon}>
						<Feather name="check" size={34} color="#2F6E5D" />
					</View>

					<Text style={styles.successTitle}>Impressão enviada</Text>

					<Text style={styles.successDescription}>
						A foto agendada foi enviada
						{device ? (
							<>
								{" "}
								para{" "}
								<Text style={styles.descriptionStrong}>
									{device.name}
								</Text>
							</>
						) : null}
						.
					</Text>

					{device ? (
						<View style={styles.deviceCard}>
							<View style={styles.deviceImageContainer}>
								<Image
									source={require("../../../../assets/placeholders/home-device-1.png")}
									style={styles.deviceImage}
									resizeMode="cover"
								/>
							</View>

							<View style={styles.deviceInfo}>
								<Text
									style={styles.deviceName}
									numberOfLines={2}
								>
									{device.name}
								</Text>

								<Text style={styles.deviceMeta}>
									Agendamento enviado com sucesso
								</Text>
							</View>
						</View>
					) : null}

					<View style={styles.infoCard}>
						<View style={styles.infoIcon}>
							<Feather
								name="refresh-cw"
								size={21}
								color="#527F77"
							/>
						</View>

						<View style={styles.infoContent}>
							<Text style={styles.infoTitle}>
								Dispositivo pronto para sincronizar
							</Text>

							<Text style={styles.infoText}>
								A foto será exibida quando o quadro fizer a
								próxima sincronização.
							</Text>
						</View>
					</View>
				</View>

				<Pressable
					style={({ pressed }) => [
						styles.primaryButton,
						pressed && styles.primaryButtonPressed,
					]}
					onPress={finish}
				>
					<Text style={styles.primaryButtonText}>
						Voltar aos quadros
					</Text>

					<Feather name="arrow-right" size={20} color="#FFFFFF" />
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,

		backgroundColor: "#FAF9F7",

		alignItems: "center",

		paddingHorizontal: 16,
		paddingVertical: 14,
	},

	screenCompact: {
		paddingHorizontal: 10,
		paddingVertical: 10,
	},

	card: {
		flex: 1,

		width: "100%",
		maxWidth: 720,

		backgroundColor: "#FFFFFF",

		borderRadius: 24,

		paddingHorizontal: 24,
		paddingTop: 28,
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

		paddingHorizontal: 18,
		paddingTop: 24,
		paddingBottom: 10,
	},

	content: {
		flex: 1,

		alignItems: "center",
	},

	successIcon: {
		width: 72,
		height: 72,

		borderRadius: 36,

		backgroundColor: "#EDF2F1",

		alignItems: "center",
		justifyContent: "center",

		marginTop: 22,
		marginBottom: 18,
	},

	successTitle: {
		fontSize: 26,
		lineHeight: 32,
		fontWeight: "700",

		color: "#1A1A1A",

		textAlign: "center",
	},

	successDescription: {
		maxWidth: 440,

		marginTop: 8,

		fontSize: 15,
		lineHeight: 21,

		color: "#666666",

		textAlign: "center",
	},

	descriptionStrong: {
		fontWeight: "700",
		color: "#1A1A1A",
	},

	deviceCard: {
		width: "100%",

		marginTop: 28,

		paddingHorizontal: 16,
		paddingVertical: 16,

		borderWidth: 1,
		borderColor: "#EEEEEE",
		borderRadius: 14,

		backgroundColor: "#FFFFFF",

		flexDirection: "row",
		alignItems: "center",

		gap: 14,

		shadowColor: "#000000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.04,
		shadowRadius: 8,

		elevation: 1,
	},

	deviceImageContainer: {
		width: 64,
		height: 76,

		flexShrink: 0,

		borderRadius: 10,
		overflow: "hidden",

		backgroundColor: "#F4F5F4",
	},

	deviceImage: {
		width: "100%",
		height: "100%",
	},

	deviceInfo: {
		flex: 1,
	},

	deviceName: {
		fontSize: 17,
		lineHeight: 22,
		fontWeight: "700",

		color: "#1A1A1A",
	},

	deviceMeta: {
		marginTop: 4,

		fontSize: 14,
		lineHeight: 20,

		color: "#666666",
	},

	infoCard: {
		width: "100%",

		marginTop: 18,

		paddingHorizontal: 16,
		paddingVertical: 16,

		borderRadius: 14,

		backgroundColor: "#EDF2F1",

		flexDirection: "row",
		alignItems: "center",

		gap: 14,
	},

	infoIcon: {
		width: 46,
		height: 46,

		flexShrink: 0,

		borderRadius: 23,

		backgroundColor: "#FFFFFF",

		alignItems: "center",
		justifyContent: "center",
	},

	infoContent: {
		flex: 1,
	},

	infoTitle: {
		fontSize: 16,
		lineHeight: 21,
		fontWeight: "700",

		color: "#3E6E63",

		marginBottom: 3,
	},

	infoText: {
		fontSize: 14,
		lineHeight: 20,

		color: "#666666",
	},

	primaryButton: {
		minHeight: 48,

		paddingHorizontal: 16,
		paddingVertical: 12,

		borderRadius: 12,

		backgroundColor: "#668882",

		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",

		gap: 10,
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
});
