#include <WiFi.h>

#include "SDManager.h"
#include "FirebaseManager.h"

#define WIFI_SSID "OJEDA"
#define WIFI_PASSWORD "mateus118"

#define API_KEY "AIzaSyCzNPNS0mugUk31NpC1XGKKZjR6qQPHF50"

#define DEVICE_ID "cbbgxcjjhccnnvccbbb"

#define STORAGE_BUCKET_ID "einkcanvas.firebasestorage.app"

SDManager sd;

FirebaseManager firebase;

void setup()
{
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=== TESTE FIRESTORE DO DISPOSITIVO ===");


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

  Serial.print("IP: ");
  Serial.println(WiFi.localIP());


  // ============================================================
  // SD
  // ============================================================

  Serial.println();
  Serial.println("=== INICIALIZANDO SD ===");

  if (!sd.begin(Serial))
  {
    Serial.println(
      "ERRO: não foi possível inicializar o SD."
    );

    return;
  }


  // ============================================================
  // FIREBASE
  // ============================================================

  firebase.begin(
    API_KEY,
    STORAGE_BUCKET_ID,
    Serial
  );

  if (!firebase.authenticate())
    return;


  // ============================================================
  // FIRESTORE - DEVICE
  // ============================================================

  Serial.println();
  Serial.println("=== TESTANDO LEITURA DO DEVICE ===");

  firebase.readDeviceConfig(DEVICE_ID);


  // ============================================================
  // FIRESTORE - STATUS
  // ============================================================

  Serial.println();
  Serial.println("=== TESTANDO STATUS DO DEVICE ===");

  // Temporariamente mantido aqui.
  // Vamos colocar isso no FirebaseManager no próximo passo.


  // ============================================================
  // FIREBASE STORAGE
  // ============================================================

  Serial.println();
  Serial.println("=== TESTANDO STORAGE ===");

  String storagePath =
    "devices/cbbgxcjjhccnnvccbbb/"
    "collections/ftmNhC36LdG6TxWl3nat/"
    "images/Ew53SMTv4mxOfaIb94IS/"
    "display.bin";

  if (firebase.downloadImage(
        storagePath.c_str(),
        "/test-display.bin"
      ))
  {
    Serial.println();
    Serial.println("Verificando arquivo no SD...");

    if (sd.exists("/test-display.bin"))
    {
      Serial.println("Arquivo encontrado no SD.");

      Serial.print("Tamanho: ");
      Serial.print(sd.size("/test-display.bin"));
      Serial.println(" bytes");
    }
    else
    {
      Serial.println(
        "ERRO: arquivo não encontrado no SD."
      );
    }
  }


  Serial.println();
  Serial.println("=== TESTE CONCLUÍDO ===");
}

void loop()
{
}