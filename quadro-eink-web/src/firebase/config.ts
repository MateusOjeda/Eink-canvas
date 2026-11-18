import { initializeApp } from "firebase/app";

import { getAuth } from "firebase/auth";

import { getFirestore } from "firebase/firestore";

import { getStorage } from "firebase/storage";

// Login por redirect no Safari/iPhone exige que o authDomain e o endereco
// efetivo do app sejam a mesma origem. O Firebase Hosting oferece dois hosts
// (web.app e firebaseapp.com); ambos devem ser reconhecidos.
// Fora do Hosting oficial (por exemplo, localhost), preservar o authDomain
// configurado no ambiente.
const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const hostedOrigin =
	typeof window !== "undefined" ? window.location.hostname : "";
const configuredAuthDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
const hostingNameFromAuth = configuredAuthDomain?.endsWith(".firebaseapp.com")
	? configuredAuthDomain.slice(0, -".firebaseapp.com".length)
	: undefined;
const isProjectHostingDomain = [projectId, hostingNameFromAuth].some(
	(name) => Boolean(name && (
		hostedOrigin === `${name}.web.app` ||
		hostedOrigin === `${name}.firebaseapp.com`
	)),
);
const sameOriginAuthDomain = isProjectHostingDomain
	? hostedOrigin
	: configuredAuthDomain;

const firebaseConfig = {
	apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
	authDomain: sameOriginAuthDomain,
	projectId,
	storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

export const storage = getStorage(app);
