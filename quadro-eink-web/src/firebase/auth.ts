import {
	getRedirectResult,
	GoogleAuthProvider,
	signInWithPopup,
	signInWithRedirect,
	signOut,
} from "firebase/auth";

import { auth } from "./config";

const googleProvider = new GoogleAuthProvider();
const LOGIN_MARKER = "einkcanvas-google-redirect-start";

// Nenhum token, email ou UID e registrado neste diagnostico.
function probeStorage(storage: Storage): string {
	const key = "__einkcanvas_storage_probe__";
	try {
		storage.setItem(key, "ok");
		const ok = storage.getItem(key) === "ok";
		storage.removeItem(key);
		return ok ? "ok" : "falhou";
	} catch {
		return "bloqueado";
	}
}

export function hadRecentGoogleRedirectAttempt(): boolean {
	if (typeof window === "undefined") return false;
	try {
		const start = Number(window.sessionStorage.getItem(LOGIN_MARKER));
		return Number.isFinite(start) && start > 0 &&
			Date.now() - start < 10 * 60 * 1000;
	} catch {
		return false;
	}
}

export function googleAuthDiagnostics(): string {
	if (typeof window === "undefined") return "ambiente=sem navegador";
	let session = "bloqueado";
	let local = "bloqueado";
	try { session = probeStorage(window.sessionStorage); } catch { /* acesso bloqueado */ }
	try { local = probeStorage(window.localStorage); } catch { /* acesso bloqueado */ }
	const authDomain = auth.app.options.authDomain || "ausente";
	return [
		`site=${window.location.hostname}`,
		`authDomain=${authDomain}`,
		`sessionStorage=${session}`,
		`localStorage=${local}`,
		`marcadorRedirect=${hadRecentGoogleRedirectAttempt() ? "presente" : "ausente"}`,
	].join("\n");
}

// No iOS e Android, a janela auxiliar do popup pode usar um armazenamento
// diferente do site de origem. O redirect acontece na mesma aba, evitando
// depender da comunicacao entre janelas/tabs no retorno do Google.
function isMobileBrowser(): boolean {
	if (typeof navigator === "undefined") return false;
	const agent = navigator.userAgent;
	return (
		/Android|iPhone|iPad|iPod/i.test(agent) ||
		(/Macintosh/i.test(agent) && navigator.maxTouchPoints > 1)
	);
}

export async function signInWithGoogle(): Promise<void> {
	if (isMobileBrowser()) {
		// A marca permite distinguir um retorno sem credencial de uma visita normal.
		try { window.sessionStorage.setItem(LOGIN_MARKER, String(Date.now())); }
		catch { /* registrar a ausencia no diagnostico */ }
		await signInWithRedirect(auth, googleProvider);
		return;
	}
	await signInWithPopup(auth, googleProvider);
}

// Chamado no carregamento da pagina, depois que o Google devolve o usuario.
// O onAuthStateChanged continua responsavel por atualizar a interface.
export async function finishGoogleRedirectSignIn(): Promise<"usuario" | "sem-resultado" | "sem-navegador"> {
	if (typeof window === "undefined") return "sem-navegador";
	const credential = await getRedirectResult(auth);
	return credential?.user ? "usuario" : "sem-resultado";
}

export function googleSignInErrorMessage(error: unknown): string {
	const code =
		typeof error === "object" && error !== null && "code" in error
			? String(error.code)
			: "";
	switch (code) {
		case "auth/unauthorized-domain":
			return "Este dominio ainda nao esta autorizado no Firebase Authentication.";
		case "auth/operation-not-allowed":
			return "O login com Google nao esta habilitado no Firebase Authentication.";
		case "auth/web-storage-unsupported":
			return "Este navegador bloqueou o armazenamento necessario ao login. Verifique se nao esta no modo privado ou com armazenamento restrito.";
		case "auth/popup-blocked":
			return "O navegador bloqueou a janela de login. Tente novamente.";
		case "auth/popup-closed-by-user":
			return "O login foi interrompido antes de terminar. Tente novamente.";
		case "auth/network-request-failed":
			return "Falha de conexao durante o login. Verifique a internet e tente novamente.";
		default:
			return `Nao foi possivel entrar com Google${code ? ` (${code})` : ""}. Tente novamente.`;
	}
}

export async function signOutUser() {
	await signOut(auth);
}
