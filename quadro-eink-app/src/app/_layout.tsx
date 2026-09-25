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

			<Stack>
				<Stack.Screen
					name="login"
					options={{
						headerShown: false,
					}}
				/>

				<Stack.Screen
					name="index"
					options={{
						title: "Quadro",
						headerShown: false,
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
					name="settings"
					options={{
						title: "Configurações",
					}}
				/>

				<Stack.Screen
					name="preview-photo"
					options={{
						title: "Prévia",
					}}
				/>

				<Stack.Screen
					name="device/[deviceId]"
					options={{
						title: "Quadro",
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
