import { useEffect } from "react";
import { Platform } from "react-native";

// Expo substitui esta variavel por um literal em cada export web.
const BUILD_VERSION = process.env.EXPO_PUBLIC_EINKCANVAS_BUILD_ID;
const AUTH_REDIRECT_MARKER = "einkcanvas-google-redirect-start";
const CHECK_INTERVAL_MS = 60_000;
const MIN_IDLE_MS = 25_000;
const REDIRECT_GRACE_MS = 90_000;

// Verifica se o site implantado mudou. Nunca interfere com navegacao nativa.
export default function WebVersionWatcher() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !BUILD_VERSION) {
      return;
    }

    let cancelled = false;
    let checking = false;
    let pendingVersion = "";
    let lastInteraction = Date.now();

    function recentGoogleRedirect(): boolean {
      try {
        const started = Number(window.sessionStorage.getItem(AUTH_REDIRECT_MARKER));
        return Number.isFinite(started) && started > 0 &&
          Date.now() - started >= 0 && Date.now() - started < REDIRECT_GRACE_MS;
      } catch {
        return false;
      }
    }

    function canReload(): boolean {
      if (document.visibilityState !== "visible") return false;
      // Nao perder foto escolhida, edicao ou envio em andamento.
      if (window.location.pathname.startsWith("/send-photo/")) return false;
      // Nao interromper a recuperacao do login apos retornar do Google.
      if (recentGoogleRedirect()) return false;
      // Evitar interromper interacoes da pessoa na tela.
      return Date.now() - lastInteraction >= MIN_IDLE_MS;
    }

    function reloadIfNeeded() {
      if (!pendingVersion || !canReload()) return;
      const url = new URL(window.location.href);
      if (url.searchParams.get("__eink_build") === pendingVersion) {
        // Evita loop se o navegador/Service Worker ainda servir o build antigo.
        return;
      }
      url.searchParams.set("__eink_build", pendingVersion);
      console.info("EinkCanvas: nova versao detectada; atualizando pagina.");
      window.location.replace(url.toString());
    }

    async function checkVersion() {
      if (checking || cancelled || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await window.fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const latest = (await response.json()) as { version?: unknown };
        if (cancelled || typeof latest.version !== "string") return;
        if (latest.version !== BUILD_VERSION) {
          pendingVersion = latest.version;
          reloadIfNeeded();
        }
      } catch {
        // Offline ou deploy incompleto: manter o app funcionando normalmente.
      } finally {
        checking = false;
      }
    }

    const markInteraction = () => { lastInteraction = Date.now(); };
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };
    const onFocus = () => { void checkVersion(); };
    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("touchstart", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    // No boot, dar tempo para o Firebase resolver um eventual redirect.
    const firstCheck = window.setTimeout(() => { void checkVersion(); }, 8_000);
    const poll = window.setInterval(() => {
      if (pendingVersion) reloadIfNeeded();
      void checkVersion();
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(firstCheck);
      window.clearInterval(poll);
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
