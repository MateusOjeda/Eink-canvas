import "react-native-gesture-handler";

import { useEffect, useState } from "react";

import { ActivityIndicator, StyleSheet, View } from "react-native";

import { router, Stack, usePathname } from "expo-router";

import { GestureHandlerRootView } from "react-native-gesture-handler";

import { NavigationBar } from "expo-navigation-bar";

import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/firebase/config";

export default function RootLayout() {
	const pathname = usePathname();

	const [user, setUser] = useState<User | null>(null);

	const [authReady, setAuthReady] = useState(false);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			setUser(currentUser);
			setAuthReady(true);
		});

		return unsubscribe;
	}, []);

	useEffect(() => {
		if (!authReady) {
			return;
		}

		const isLoginScreen = pathname === "/login";

		if (!user && !isLoginScreen) {
			router.replace("/login");

			return;
		}

		if (user && isLoginScreen) {
			router.replace("/");
		}
	}, [authReady, pathname, user]);

	if (!authReady) {
		return (
			<GestureHandlerRootView style={styles.root}>
				<NavigationBar hidden />

				<View style={styles.loading}>
					<ActivityIndicator size="large" />
				</View>
			</GestureHandlerRootView>
		);
	}

	return (
		<GestureHandlerRootView style={styles.root}>
			<NavigationBar hidden />

			<Stack
				screenOptions={{
					animation: "none",
					headerTitleStyle: {
						fontSize: 20,
						fontWeight: "700",
						color: "#4e4e4e",
					},
				}}
			>
				<Stack.Screen
					name="login"
					options={{
						headerShown: false,
					}}
				/>

				<Stack.Screen
					name="index"
					options={{
						title: "Meus quadros",
					}}
				/>

				<Stack.Screen
					name="register-device"
					options={{
						title: "Adicionar quadro",
					}}
				/>

				<Stack.Screen
					name="device/[deviceId]"
					options={{
						title: "",
					}}
				/>

				<Stack.Screen
					name="device/[deviceId]/edit"
					options={{
						title: "Editar quadro",
					}}
				/>

				<Stack.Screen
					name="device/[deviceId]/collection/[collectionId]"
					options={{
						title: "",
					}}
				/>

				<Stack.Screen
					name="device/[deviceId]/collection/[collectionId]/photo/[photoId]"
					options={{
						title: "",
					}}
				/>

				<Stack.Screen
					name="device/[deviceId]/temporary-photos"
					options={{
						title: "Fotos temporárias",
					}}
				/>

				<Stack.Screen
					name="device/[deviceId]/temporary-photo"
					options={{
						title: "Adicionar foto temporária",
					}}
				/>

				<Stack.Screen
					name="add-photo"
					options={{
						title: "Adicionar foto",
					}}
				/>

				<Stack.Screen
					name="crop-photo"
					options={{
						title: "Ajustar foto",
					}}
				/>

				<Stack.Screen
					name="preview-photo"
					options={{
						title: "Prévia",
					}}
				/>

				<Stack.Screen
					name="settings"
					options={{
						title: "Configurações",
					}}
				/>
			</Stack>
		</GestureHandlerRootView>
	);
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},

	loading: {
		flex: 1,

		alignItems: "center",
		justifyContent: "center",
	},
});
