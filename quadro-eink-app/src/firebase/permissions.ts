import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";

import { db } from "./config";

export type UploadAccessRequest = {
  uid: string;
  email: string;
  requestedAt: Date | null;
};

export type AuthorizedUploader = {
  uid: string;
  email: string;
  grantedAt: Date | null;
};

function toDate(value: unknown): Date | null {
  if (value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate();
  }
  return null;
}

export async function getUploadAccessRequests(
  deviceId: string,
): Promise<UploadAccessRequest[]> {
  const snapshot = await getDocs(
    collection(db, "devices", deviceId, "uploadAccessRequests"),
  );

  return snapshot.docs.map((item) => ({
    uid: item.id,
    email: String(item.data().email ?? ""),
    requestedAt: toDate(item.data().requestedAt),
  }));
}

export async function getAuthorizedUploaders(
  deviceId: string,
): Promise<AuthorizedUploader[]> {
  const snapshot = await getDocs(
    collection(db, "devices", deviceId, "uploadAccessGrants"),
  );

  return snapshot.docs.map((item) => ({
    uid: item.id,
    email: String(item.data().email ?? ""),
    grantedAt: toDate(item.data().grantedAt),
  }));
}

export async function approveUploadAccessRequest(
  deviceId: string,
  uid: string,
  deviceName: string,
): Promise<void> {
  const requestRef = doc(db, "devices", deviceId, "uploadAccessRequests", uid);
  const permissionRef = doc(db, "temporaryUploadPermissions", uid, "devices", deviceId);
  const grantRef = doc(db, "devices", deviceId, "uploadAccessGrants", uid);

  // A transação confirma que a solicitação ainda existe e grava a autorização
  // e seu índice de gerenciamento no mesmo commit.
  await runTransaction(db, async (transaction) => {
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists()) {
      throw new Error("A solicitação não existe mais.");
    }

    const email = requestSnapshot.data().email;
    if (typeof email !== "string" || !email) {
      throw new Error("A solicitação não tem e-mail válido.");
    }

    transaction.set(permissionRef, { label: deviceName });
    transaction.set(grantRef, { email, grantedAt: serverTimestamp() });
    transaction.delete(requestRef);
  });
}

export async function rejectUploadAccessRequest(
  deviceId: string,
  uid: string,
): Promise<void> {
  await deleteDoc(doc(db, "devices", deviceId, "uploadAccessRequests", uid));
}

export async function revokeUploadAccess(
  deviceId: string,
  uid: string,
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "temporaryUploadPermissions", uid, "devices", deviceId));
  batch.delete(doc(db, "devices", deviceId, "uploadAccessGrants", uid));
  await batch.commit();
}

// Usado durante a exclusão do quadro. A permissão efetiva é apagada primeiro,
// antes de remover o documento do dispositivo do qual dependem as regras.
export async function clearDeviceUploadPermissions(deviceId: string): Promise<void> {
  const [requests, grants] = await Promise.all([
    getUploadAccessRequests(deviceId),
    getAuthorizedUploaders(deviceId),
  ]);

  for (const grant of grants) {
    await revokeUploadAccess(deviceId, grant.uid);
  }

  for (const request of requests) {
    await rejectUploadAccessRequest(deviceId, request.uid);
  }
}
