import { Platform } from "react-native";

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "@/firebase/config";

export async function getExpoPushToken(): Promise<string | null> {
	if (!Device.isDevice) {
		throw new Error(
			"Push notifications precisam de um dispositivo físico.",
		);
	}

	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync("default", {
			name: "Notificações",
			importance: Notifications.AndroidImportance.MAX,
		});
	}

	const currentPermission = await Notifications.getPermissionsAsync();

	let status = currentPermission.status;

	if (status !== "granted") {
		const requestedPermission =
			await Notifications.requestPermissionsAsync();

		status = requestedPermission.status;
	}

	if (status !== "granted") {
		console.log("Permissão para notificações não concedida.");

		return null;
	}

	const projectId =
		Constants.expoConfig?.extra?.eas?.projectId ??
		Constants.easConfig?.projectId;

	if (!projectId) {
		throw new Error("EAS projectId não encontrado.");
	}

	const token = (
		await Notifications.getExpoPushTokenAsync({
			projectId,
		})
	).data;

	return token;
}

export async function registerExpoPushToken(uid: string): Promise<void> {
	const token = await getExpoPushToken();

	if (!token) {
		return;
	}

	await setDoc(
		doc(db, "users", uid, "pushTokens", token),
		{
			token,
			platform: Platform.OS,
			updatedAt: serverTimestamp(),
		},
		{
			merge: true,
		},
	);

	console.log("Expo Push Token registrado:", token);
}
