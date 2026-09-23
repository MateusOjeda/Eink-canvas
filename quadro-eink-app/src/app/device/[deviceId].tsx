import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { router, Stack, useLocalSearchParams } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { deleteDevice } from "@/firebase/devices";

export default function DeviceScreen() {
	const { deviceId } = useLocalSearchParams<{
		deviceId: string;
	}>();

	const handleDelete = () => {
		Alert.alert(
			"Excluir quadro",
			"Tem certeza que deseja excluir este quadro?",
			[
				{
					text: "Cancelar",
					style: "cancel",
				},
				{
					text: "Excluir",
					style: "destructive",
					onPress: async () => {
						try {
							await deleteDevice(deviceId);

							router.back();
						} catch (error) {
							console.error(error);

							Alert.alert(
								"Erro",
								"Não foi possível excluir o quadro.",
							);
						}
					},
				},
			],
		);
	};

	return (
		<>
			<Stack.Screen
				options={{
					title: "Quadro",

					headerRight: () => (
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 18,
							}}
						>
							<Pressable
								onPress={() =>
									router.push({
										pathname: "/device/[deviceId]/edit",
										params: {
											deviceId,
										},
									})
								}
								hitSlop={12}
							>
								<Ionicons
									name="pencil-outline"
									size={21}
									color="#666666"
								/>
							</Pressable>

							<Pressable onPress={handleDelete} hitSlop={12}>
								<Ionicons
									name="trash-outline"
									size={21}
									color="#666666"
								/>
							</Pressable>
						</View>
					),
				}}
			/>

			<View style={styles.container}>
				<Text style={styles.title}>Dispositivo</Text>

				<Text style={styles.id}>{deviceId}</Text>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#ffffff",
		justifyContent: "center",
		alignItems: "center",
		padding: 24,
	},

	title: {
		fontSize: 24,
		fontWeight: "700",
		marginBottom: 12,
	},

	id: {
		fontSize: 13,
		color: "#666666",
		textAlign: "center",
	},
});
