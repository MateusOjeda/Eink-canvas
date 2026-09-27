import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

initializeApp();

setGlobalOptions({
	maxInstances: 10,
});

export const notifyScheduledPhotoCreated = onDocumentCreated(
	"devices/{deviceId}/temporaryPhotos/{photoId}",
	async (event) => {
		const snapshot = event.data;

		if (!snapshot) {
			return;
		}

		const photo = snapshot.data();

		const deviceId = event.params.deviceId;
		const photoId = event.params.photoId;

		const db = getFirestore();

		const deviceSnapshot = await db
			.collection("devices")
			.doc(deviceId)
			.get();

		if (!deviceSnapshot.exists) {
			logger.warn("Quadro não encontrado.", {
				deviceId,
				photoId,
			});

			return;
		}

		const device = deviceSnapshot.data();

		const ownerUid = device?.ownerUid as string | undefined;
		const deviceName = device?.name as string | undefined;

		if (!ownerUid) {
			logger.warn("Quadro sem ownerUid.", {
				deviceId,
				photoId,
			});

			return;
		}

		/*
		 * Se o próprio dono enviou a foto pelo app,
		 * não precisamos notificá-lo.
		 */
		if (photo.createdByUid === ownerUid) {
			logger.info("Foto criada pelo próprio dono. Push ignorado.", {
				deviceId,
				photoId,
			});

			return;
		}

		const tokensSnapshot = await db
			.collection("users")
			.doc(ownerUid)
			.collection("pushTokens")
			.get();

		const tokens = tokensSnapshot.docs
			.map((document) => document.data().token)
			.filter(
				(token): token is string =>
					typeof token === "string" && token.length > 0,
			);

		if (tokens.length === 0) {
			logger.info("Proprietário não possui push tokens.", {
				deviceId,
				ownerUid,
			});

			return;
		}

		const sender =
			typeof photo.createdByEmail === "string"
				? photo.createdByEmail
				: "Alguém";

		const messages = tokens.map((token) => ({
			to: token,
			sound: "default",
			title: "Nova foto agendada",
			body: `${sender} enviou uma foto para ${
				deviceName ?? "seu quadro"
			}.`,
			data: {
				type: "scheduled-photo",
				deviceId,
				photoId,
			},
		}));

		const response = await fetch("https://exp.host/--/api/v2/push/send", {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(messages),
		});

		const responseBody = await response.text();

		if (!response.ok) {
			logger.error("Erro ao enviar push pelo Expo.", {
				status: response.status,
				responseBody,
			});

			throw new Error(
				`Expo Push Service retornou HTTP ${response.status}.`,
			);
		}

		logger.info("Notificação enviada.", {
			deviceId,
			photoId,
			tokenCount: tokens.length,
			responseBody,
		});
	},
);
