import { fetch } from "expo/fetch";
import { File } from "expo-file-system";

const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;

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

	const uploadUrl =
		`https://firebasestorage.googleapis.com/v0/b/` +
		`${encodeURIComponent(storageBucket)}/o` +
		`?name=${encodeURIComponent(path)}`;

	const response = await fetch(uploadUrl, {
		method: "POST",

		headers: {
			"Content-Type": contentType,
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
