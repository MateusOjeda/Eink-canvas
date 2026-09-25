import { fetch } from "expo/fetch";
import { File } from "expo-file-system";
import { auth } from "./config";

const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;

async function getAuthorizationHeader(): Promise<string> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error("Usuário não autenticado.");
	}

	const idToken = await user.getIdToken();

	return `Bearer ${idToken}`;
}

export async function getStorageAuthHeaders(): Promise<Record<string, string>> {
	return {
		Authorization: await getAuthorizationHeader(),
	};
}

export async function uploadLocalFile(
	uri: string,
	path: string,
	contentType: string,
): Promise<string> {
	if (!storageBucket) {
		throw new Error("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET não configurado.");
	}

	const file = new File(uri);

	if (!file.exists) {
		throw new Error(`Arquivo local não encontrado: ${uri}`);
	}

	const authorization = await getAuthorizationHeader();

	const uploadUrl =
		`https://firebasestorage.googleapis.com/v0/b/` +
		`${encodeURIComponent(storageBucket)}/o` +
		`?name=${encodeURIComponent(path)}`;

	const response = await fetch(uploadUrl, {
		method: "POST",

		headers: {
			"Content-Type": contentType,
			Authorization: authorization,
		},

		body: file,
	});

	if (!response.ok) {
		const responseText = await response.text();

		throw new Error(
			`Firebase Storage retornou ${response.status}: ${responseText}`,
		);
	}

	return path;
}

export function getStorageFileUrl(path: string): string {
	const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;

	if (!storageBucket) {
		throw new Error("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET não configurado.");
	}

	return (
		`https://firebasestorage.googleapis.com/v0/b/` +
		`${encodeURIComponent(storageBucket)}/o/` +
		`${encodeURIComponent(path)}` +
		`?alt=media`
	);
}

export async function deleteStorageFile(path: string): Promise<void> {
	const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;

	if (!storageBucket) {
		throw new Error("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET não configurado.");
	}

	const authorization = await getAuthorizationHeader();

	const deleteUrl =
		`https://firebasestorage.googleapis.com/v0/b/` +
		`${encodeURIComponent(storageBucket)}/o/` +
		`${encodeURIComponent(path)}`;

	const response = await fetch(deleteUrl, {
		method: "DELETE",

		headers: {
			Authorization: authorization,
		},
	});

	/*
	 * Se já não existe, para nós o resultado
	 * desejado também foi atingido.
	 */
	if (!response.ok && response.status !== 404) {
		const responseText = await response.text();

		throw new Error(
			`Erro ao excluir arquivo (${response.status}): ${responseText}`,
		);
	}
}
