#include <WiFi.h>
#include <Preferences.h>
#include <Firebase_ESP_Client.h>

#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

#define API_KEY "AIzaSyCzNPNS0mugUk31NpC1XGKKZjR6qQPHF50"

FirebaseConfig config;
FirebaseAuth auth;
Preferences preferences;

void setup()
{
  Serial.begin(115200);
  delay(1000);

  // ============================================================
  // WI-FI
  // ============================================================

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Conectando ao Wi-Fi");

  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("Wi-Fi conectado.");

  // ============================================================
  // FIREBASE
  // ============================================================

  config.api_key = API_KEY;

  Firebase.reconnectNetwork(true);

  Serial.println("Iniciando Firebase...");

  // ============================================================
  // NOVA SESSAO ANONIMA
  // ============================================================

  Serial.println();
  Serial.println("Criando nova sessao Anonymous...");

  if (!Firebase.signUp(
          &config,
          &auth,
          "",
          ""))
  {
    Serial.println();
    Serial.println("ERRO AO CRIAR SESSAO:");

    Serial.println(
        config.signer.signupError.message.c_str());

    return;
  }

  Serial.println();
  Serial.println("=== SESSAO CRIADA ===");

  Serial.print("UID: ");
  Serial.println(auth.token.uid.c_str());

  // ============================================================
  // INICIAR FIREBASE
  // ============================================================

  Firebase.begin(&config, &auth);

  Serial.println("Firebase iniciado.");

  // ============================================================
  // ESPERAR AUTENTICACAO
  // ============================================================

  unsigned long start = millis();

  while (!Firebase.ready())
  {
    delay(100);

    if (millis() - start > 15000)
    {
      Serial.println(
          "Timeout aguardando Firebase.");

      return;
    }
  }

  Serial.println("Firebase autenticado.");

  // ============================================================
  // REFRESH TOKEN
  // ============================================================

  const char *refreshToken =
      Firebase.getRefreshToken();

  Serial.println();
  Serial.println("Refresh token obtido.");

  if (refreshToken == nullptr ||
      strlen(refreshToken) == 0)
  {
    Serial.println(
        "ERRO: refresh token vazio.");

    return;
  }

  // ============================================================
  // SALVAR NO NVS
  // ============================================================

  preferences.begin("firebase", false);

  size_t saved =
      preferences.putString(
          "refreshToken",
          refreshToken);

  preferences.end();

  if (saved > 0)
  {
    Serial.println(
        "Refresh token salvo no NVS.");
  }
  else
  {
    Serial.println(
        "ERRO: nao foi possivel salvar o refresh token.");
  }

  Serial.println();
  Serial.println("=== PRONTO ===");
  Serial.println("UID e refresh token foram salvos.");
}

void loop()
{
}