import {
	GoogleSignin,
	isSuccessResponse,
} from "@react-native-google-signin/google-signin";

import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";

import { auth } from "@/firebase/config";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

if (!webClientId) {
	throw new Error("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID não configurado.");
}

GoogleSignin.configure({
	webClientId,
});

export async function signInWithGoogle() {
	await GoogleSignin.hasPlayServices({
		showPlayServicesUpdateDialog: true,
	});

	const response = await GoogleSignin.signIn();

	if (!isSuccessResponse(response)) {
		return null;
	}

	const idToken = response.data.idToken;

	if (!idToken) {
		throw new Error("Google Sign-In não retornou um ID token.");
	}

	const credential = GoogleAuthProvider.credential(idToken);

	return signInWithCredential(auth, credential);
}
