import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Stack, useLocalSearchParams } from "expo-router";

import { Feather, Ionicons } from "@expo/vector-icons";

export default function TemporaryPhotoScreen() {
	const { deviceId } = useLocalSearchParams<{
		deviceId: string;
	}>();

	const notImplemented = () => {
		Alert.alert("Em breve", "Esta função ainda não foi implementada.");
	};

	return (
		<>
			<Stack.Screen
				options={{
					title: "Foto temporária",
				}}
			/>

			<View style={styles.container}>
				<View style={styles.imagePlaceholder}>
					<Ionicons name="image-outline" size={42} color="#888888" />

					<Text style={styles.placeholderText}>
						Nenhuma imagem selecionada
					</Text>
				</View>

				<Pressable
					style={styles.secondaryButton}
					onPress={notImplemented}
				>
					<Feather name="image" size={19} color="#222222" />

					<Text style={styles.secondaryButtonText}>
						Selecionar foto
					</Text>
				</Pressable>

				<View style={styles.infoBox}>
					<Feather name="clock" size={19} color="#666666" />

					<Text style={styles.infoText}>
						A foto será exibida na próxima sincronização do quadro e
						permanecerá até o horário escolhido.
					</Text>
				</View>

				<Text style={styles.label}>Exibir até</Text>

				<Pressable style={styles.dateButton} onPress={notImplemented}>
					<View>
						<Text style={styles.datePlaceholder}>
							Definir data e hora
						</Text>

						<Text style={styles.dateHint}>Ainda não definido</Text>
					</View>

					<Feather name="chevron-right" size={20} color="#777777" />
				</Pressable>

				<View style={styles.rules}>
					<Text style={styles.rulesTitle}>Como vai funcionar</Text>

					<Text style={styles.rule}>
						• SYNC faz o quadro buscar a foto imediatamente.
					</Text>

					<Text style={styles.rule}>
						• NEXT descarta a foto temporária antes do vencimento.
					</Text>

					<Text style={styles.rule}>
						• Após expirar, a foto é removida e não fica no
						histórico.
					</Text>
				</View>

				<Pressable style={styles.sendButton} onPress={notImplemented}>
					<Text style={styles.sendButtonText}>
						Enviar foto temporária
					</Text>
				</Pressable>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,

		backgroundColor: "#ffffff",

		padding: 24,
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

		paddingVertical: 16,

		alignItems: "center",
	},

	sendButtonText: {
		color: "#ffffff",

		fontSize: 16,

		fontWeight: "600",
	},
});
