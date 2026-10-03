#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>

void setup() {

  Serial.begin(115200);

  delay(3000);

  Serial.println();
  Serial.println("================================");
  Serial.println("       QUADRO E-INK");
  Serial.println("       TESTE DE WI-FI");
  Serial.println("================================");
  Serial.println();

  Serial.println("Conectando ao Wi-Fi...");

  // Usa as credenciais salvas pelo provisioning
  WiFi.begin();

  unsigned long startTime = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startTime < 20000
  ) {

    Serial.print(".");

    delay(500);
  }

  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("ERRO: nao foi possivel conectar ao Wi-Fi.");

    return;
  }

  Serial.println();
  Serial.println("=== WI-FI CONECTADO ===");

  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  Serial.print("RSSI: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");

  // =========================
  // Requisicao HTTP
  // =========================

  Serial.println();
  Serial.println("=== REQUISICAO HTTP ===");
  Serial.println("Fazendo requisicao...");

  HTTPClient http;

  http.begin("http://httpbin.org/get");

  int httpCode = http.GET();

  Serial.print("HTTP status: ");
  Serial.println(httpCode);

  if (httpCode > 0) {

    String response = http.getString();

    Serial.println();
    Serial.println("Resposta:");
    Serial.println(response);

  } else {

    Serial.print("Erro HTTP: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();

  Serial.println();
  Serial.println("=== FIM ===");
}

void loop() {

  delay(1000);
}