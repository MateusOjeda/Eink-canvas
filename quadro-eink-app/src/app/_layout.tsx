import "react-native-gesture-handler";

import { useEffect, useRef, useState } from "react";

import { ActivityIndicator, StyleSheet, View } from "react-native";

import { router, Stack, usePathname } from "expo-router";

import { GestureHandlerRootView } from "react-native-gesture-handler";

import { NavigationBar } from "expo-navigation-bar";

import * as Notifications from "expo-notifications";

import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "@/firebase/config";

import { registerExpoPushToken } from "@/notifications/push";

export default function RootLayout() {
	const pathname = usePathname();

	const [user, setUser] = useState<User | null>(null);

	const [authReady, setAuthReady] = useState(false);

	const handledNotification = useRef<string | null>(null);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			setUser(currentUser);
			setAuthReady(true);
		});

		return unsubscribe;
	}, []);

	useEffect(() => {
		if (!authReady || !user) {
			return;
		}

		registerExpoPushToken(user.uid).catch((error) => {
			console.error("Erro ao registrar Expo Push Token:", error);
		});
	}, [authReady, user]);

	useEffect(() => {
		if (!authReady || !user) {
			return;
		}

		const handleNotificationResponse = (
			response: Notifications.NotificationResponse,
		) => {
			const notificationId = response.notification.request.identifier;

			if (handledNotification.current === notificationId) {
				return;
			}

			const data = response.notification.request.content.data;

			if (
				!data ||
				data.type !== "scheduled-photo" ||
				typeof data.deviceId !== "string"
			) {
				return;
			}

			handledNotification.current = notificationId;

			router.push({
				pathname: "/device/[deviceId]/temporary-photos",
				params: {
					deviceId: data.deviceId,
				},
			});
		};

		const response = Notifications.getLastNotificationResponse();

		if (response) {
			handleNotificationResponse(response);
		}

		const subscription =
			Notifications.addNotificationResponseReceivedListener(
				handleNotificationResponse,
			);

		return () => {
			subscription.remove();
		};
	}, [authReady, user]);

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
					name="edit-device"
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
						title: "Fotos agendadas",
					}}
				/>

				<Stack.Screen
					name="device/[deviceId]/temporary-photo"
					options={{
						title: "Adicionar foto agendada",
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
