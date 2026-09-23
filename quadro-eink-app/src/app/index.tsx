import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.title}>Quadro Eink</Text>

				<Pressable onPress={() => router.push("/settings")}>
					<Text style={styles.settings}>Configurações</Text>
				</Pressable>
			</View>

			<View style={styles.content}>
				<Text style={styles.emptyTitle}>Nenhuma foto ainda</Text>

				<Text style={styles.emptyText}>
					Adicione uma foto para começar.
				</Text>
			</View>

			<Pressable
				style={styles.button}
				onPress={() => router.push("/add-photo")}
			>
				<Text style={styles.buttonText}>Adicionar foto</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 24,
		backgroundColor: "#ffffff",
	},

	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},

	title: {
		fontSize: 28,
		fontWeight: "700",
	},

	settings: {
		fontSize: 15,
	},

	content: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},

	emptyTitle: {
		fontSize: 20,
		fontWeight: "600",
	},

	emptyText: {
		marginTop: 8,
		fontSize: 15,
	},

	button: {
		paddingVertical: 16,
		borderRadius: 12,
		backgroundColor: "#111111",
		alignItems: "center",
	},

	buttonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
});
