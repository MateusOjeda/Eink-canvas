import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationBar } from "expo-navigation-bar";

export default function RootLayout() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<NavigationBar hidden />
			<Stack>
				<Stack.Screen
					name="index"
					options={{ title: "Quadro", headerShown: false }}
				/>

				<Stack.Screen
					name="add-photo"
					options={{ title: "Adicionar foto" }}
				/>

				<Stack.Screen
					name="crop-photo"
					options={{ title: "Ajustar foto" }}
				/>

				<Stack.Screen
					name="settings"
					options={{ title: "Configurações" }}
				/>
				<Stack.Screen
					name="preview-photo"
					options={{
						title: "Prévia",
					}}
				/>
			</Stack>
		</GestureHandlerRootView>
	);
}
