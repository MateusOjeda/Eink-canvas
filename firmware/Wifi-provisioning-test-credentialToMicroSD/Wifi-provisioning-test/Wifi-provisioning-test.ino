// Obs.: Partition Scheme: 16M Flash (3MB APP/9.9MB FATFS)

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiProv.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <SD.h>

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include "esp_mac.h"

const int SD_CS   = 48;
const int SD_MOSI = 47;
const int SD_MISO = 13;
const int SD_SCK  = 21;

const int WIFI_CONFIG_BUTTON = 46;

const char *POP = "12345678";
const char *SERVICE_NAME = "QuadroEink";
const String displayType = "spectra6-7.3";

// =========================
// BLE de configuração do QuadroEink
// =========================

#define DEVICE_SERVICE_UUID \
  "7b7c0001-4e69-4d91-9a31-7d5e8f000001"

#define DEVICE_MAC_CHARACTERISTIC \
  "7b7c0002-4e69-4d91-9a31-7d5e8f000001"

BLECharacteristic *deviceMacCharacteristic = nullptr;

String deviceMac;

volatile bool provisioningRequested = false;

// =========================
// UUID do WiFi Provisioning
// =========================

uint8_t UUID[16] = {
  0xb4, 0xdf, 0x5a, 0x1c,
  0x3f, 0x6b,
  0xf4, 0xbf,
  0xea, 0x4a, 0x82, 0x03,
  0x04, 0x90, 0x1a, 0x02
};

// =========================
// ESTADO DO WI-FI
// =========================

volatile bool wifiReady = false;

// =========================
// MICROSD
// =========================

bool initSD() {

  Serial.println();
  Serial.println("=== INICIALIZANDO MICROSD ===");

  SPI.begin(
    SD_SCK,
    SD_MISO,
    SD_MOSI,
    SD_CS
  );

  if (!SD.begin(SD_CS, SPI, 1000000)) {

    Serial.println(
      "ERRO: nao foi possivel inicializar o cartao."
    );

    return false;
  }

  Serial.println("Cartao inicializado!");

  Serial.print("Tipo: ");

  uint8_t cardType = SD.cardType();

  if (cardType == CARD_MMC) {
    Serial.println("MMC");
  }
  else if (cardType == CARD_SD) {
    Serial.println("SDSC");
  }
  else if (cardType == CARD_SDHC) {
    Serial.println("SDHC");
  }
  else {
    Serial.println("Desconhecido");
  }

  Serial.print("Tamanho: ");
  Serial.print(
    SD.cardSize() / (1024 * 1024)
  );
  Serial.println(" MB");

  Serial.print("Espaco usado: ");
  Serial.print(
    SD.usedBytes() / (1024 * 1024)
  );
  Serial.println(" MB");

  Serial.print("Espaco total: ");
  Serial.print(
    SD.totalBytes() / (1024 * 1024)
  );
  Serial.println(" MB");

  return true;
}

void testSD() {

  const char *TEST_FILE = "/teste.txt";

  Serial.println();
  Serial.println("=== TESTE DO MICROSD ===");
  Serial.println();

  Serial.println("Escrevendo /teste.txt...");

  File file = SD.open(
    TEST_FILE,
    FILE_WRITE
  );

  if (!file) {

    Serial.println(
      "ERRO: nao foi possivel abrir o arquivo para escrita."
    );

    return;
  }

  file.println("Quadro E-Ink");
  file.println("Teste de MicroSD + Wi-Fi + BLE.");

  file.close();

  Serial.println(
    "Arquivo escrito com sucesso!"
  );

  Serial.println();
  Serial.println("Lendo /teste.txt...");
  Serial.println("--------------------------------");

  file = SD.open(TEST_FILE);

  if (!file) {

    Serial.println(
      "ERRO: nao foi possivel abrir o arquivo para leitura."
    );

    return;
  }

  while (file.available()) {
    Serial.write(file.read());
  }

  file.close();

  Serial.println("--------------------------------");
  Serial.println("Leitura concluida!");
}

// =========================
// EVENTOS DO PROVISIONING
// =========================

void SysProvEvent(arduino_event_t *event) {

  switch (event->event_id) {

    case ARDUINO_EVENT_WIFI_READY:

      wifiReady = true;

      Serial.println();
      Serial.println(
        "Wi-Fi pronto."
      );

      break;

    case ARDUINO_EVENT_PROV_START:

      Serial.println();
      Serial.println(
        "=== PROVISIONAMENTO BLE ==="
      );

      Serial.println(
        "Aguardando configuracao pelo celular..."
      );

      break;

    case ARDUINO_EVENT_PROV_CRED_RECV:

      Serial.println();
      Serial.println(
        "Credenciais recebidas!"
      );

      Serial.print("SSID: ");

      Serial.println(
        (const char *)
          event->event_info.prov_cred_recv.ssid
      );

      break;

    case ARDUINO_EVENT_PROV_CRED_SUCCESS:

      Serial.println();
      Serial.println(
        "Wi-Fi configurado com sucesso!"
      );

      break;

    case ARDUINO_EVENT_PROV_CRED_FAIL:

      Serial.println();
      Serial.println(
        "ERRO: falha ao configurar Wi-Fi."
      );

      if (
        event->event_info.prov_fail_reason ==
        NETWORK_PROV_WIFI_STA_AUTH_ERROR
      ) {

        Serial.println(
          "Senha do Wi-Fi incorreta."
        );

      } else {

        Serial.println(
          "Rede Wi-Fi nao encontrada."
        );
      }

      Serial.println();
      Serial.println(
        "Reiniciando dispositivo em 2 segundos..."
      );

      delay(2000);

      ESP.restart();

      break;

    case ARDUINO_EVENT_PROV_END:

      Serial.println();
      Serial.println(
        "Provisionamento encerrado."
      );

      break;

    case ARDUINO_EVENT_WIFI_STA_GOT_IP:

      Serial.println();
      Serial.println(
        "=== WI-FI CONECTADO ==="
      );

      Serial.print("IP: ");
      Serial.println(
        WiFi.localIP()
      );

      Serial.print("RSSI: ");
      Serial.print(
        WiFi.RSSI()
      );
      Serial.println(" dBm");

      Serial.print("MAC Wi-Fi: ");
      Serial.println(
        WiFi.STA.macAddress()
      );

      break;

    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:

      Serial.println();
      Serial.println(
        "Wi-Fi desconectado."
      );

      break;

    default:
      break;
  }
}

// =========================
// Só para pegar endereço MAC
// =========================

bool initializeWiFiMac() {

  Serial.println();
  Serial.println("Inicializando Wi-Fi para obter MAC...");

  WiFi.mode(WIFI_STA);
  WiFi.begin();

  unsigned long startTime = millis();

  while (millis() - startTime < 20000) {

    deviceMac = WiFi.STA.macAddress();

    if (
      deviceMac.length() > 0 &&
      deviceMac != "00:00:00:00:00:00"
    ) {

      Serial.print("MAC Wi-Fi obtido: ");
      Serial.println(deviceMac);

      WiFi.disconnect();

      Serial.println("Wi-Fi encerrado.");

      return true;
    }

    delay(100);
  }

  Serial.println(
    "ERRO: nao foi possivel obter o MAC Wi-Fi em 20 segundos."
  );

  WiFi.disconnect();

  return false;
}

// =========================
// BLE DO MODO DE CONFIGURAÇÃO
// =========================

class DeviceBLECallback : public BLECharacteristicCallbacks {

  void onWrite(BLECharacteristic *characteristic) override {

    String value = characteristic->getValue();

    Serial.println();
    Serial.println("=== COMANDO BLE RECEBIDO ===");
    Serial.print("Conteudo recebido: ");
    Serial.println(value);

    const char *CERTIFICATE_FILE = "/certificate.txt";

    if (SD.exists(CERTIFICATE_FILE)) {

      Serial.println(
        "Certificado anterior encontrado. Apagando..."
      );

      if (!SD.remove(CERTIFICATE_FILE)) {

        Serial.println(
          "ERRO: nao foi possivel apagar o certificado anterior."
        );

        return;
      }

      Serial.println(
        "Certificado anterior apagado."
      );
    }

    File file = SD.open(
      CERTIFICATE_FILE,
      FILE_WRITE
    );

    if (!file) {

      Serial.println(
        "ERRO: nao foi possivel abrir o arquivo para escrita."
      );

      return;
    }

    file.print(value);

    file.close();

    Serial.println(
      "Certificado salvo no MicroSD."
    );

    provisioningRequested = true;

    Serial.println(
      "Provisioning solicitado."
    );
  }
};

void startDeviceBLE() {

  Serial.println();

  Serial.println(
    "=== BLE DE CONFIGURACAO DO QUADROEINK ==="
  );

  Serial.print("MAC Wi-Fi: ");
  Serial.println(deviceMac);

  BLEDevice::init(
    SERVICE_NAME
  );

  BLEServer *server =
    BLEDevice::createServer();

  BLEService *service =
    server->createService(
      DEVICE_SERVICE_UUID
    );

  deviceMacCharacteristic =
    service->createCharacteristic(
      DEVICE_MAC_CHARACTERISTIC,
      BLECharacteristic::PROPERTY_READ |
      BLECharacteristic::PROPERTY_WRITE
    );

  deviceMacCharacteristic->setCallbacks(
    new DeviceBLECallback()
  );

  String deviceInfo = deviceMac + "|" + displayType;

  deviceMacCharacteristic->setValue(
    deviceInfo.c_str()
  );

  service->start();

  BLEAdvertising *advertising =
    BLEDevice::getAdvertising();

  advertising->addServiceUUID(
    DEVICE_SERVICE_UUID
  );

  advertising->setScanResponse(true);

  BLEDevice::startAdvertising();

  Serial.println(
    "BLE de configuracao ativo."
  );

  Serial.println(
    "MAC disponivel para o aplicativo."
  );
}

// =========================
// WIFI PROVISIONING
// =========================

void startWiFiProvisioning() {

  Serial.println();
  Serial.println(
    "================================"
  );
  Serial.println(
    "     MODO CONFIGURACAO WI-FI"
  );
  Serial.println(
    "================================"
  );
  Serial.println();


  Serial.println();
  Serial.println(
    "Apagando configuracao Wi-Fi atual..."
  );

  if (!WiFi.disconnect(false, true)) {

    Serial.println(
      "AVISO: nao foi possivel apagar a configuracao Wi-Fi."
    );

  } else {

    Serial.println(
      "Configuracao Wi-Fi apagada."
    );
  }

  Serial.println();
  Serial.println(
    "Encerrando BLE de identificacao..."
  );


  Serial.println();
  Serial.println(
    "Iniciando provisioning BLE..."
  );

  WiFiProv.beginProvision(
    NETWORK_PROV_SCHEME_BLE,
    NETWORK_PROV_SCHEME_HANDLER_FREE_BLE,
    NETWORK_PROV_SECURITY_1,
    POP,
    "PROV_QuadroEink",
    NULL,
    UUID,
    true
  );

  // WiFiProv.printQR(
  //   "PROV_QuadroEink",
  //   POP,
  //   "ble"
  // );

  Serial.println();
  Serial.println(
    "BLE de provisioning ativo."
  );

  Serial.println(
    "Use o aplicativo para configurar o Wi-Fi."
  );
}

// =========================
// CONEXAO WI-FI NORMAL
// =========================

void connectToSavedWiFi() {

  Serial.println();
  Serial.println(
    "================================"
  );
  Serial.println(
    "       CONEXAO WI-FI NORMAL"
  );
  Serial.println(
    "================================"
  );
  Serial.println();

  // =========================
  // ESPERA WI-FI FICAR PRONTO
  // =========================

  Serial.println(
    "Aguardando servico Wi-Fi ficar pronto..."
  );

  wifiReady = false;

  unsigned long startTime =
    millis();

  while (
    !wifiReady &&
    millis() - startTime < 20000
  ) {

    Serial.print(".");
    delay(500);
  }

  Serial.println();

  if (!wifiReady) {

    Serial.println();
    Serial.println(
      "ERRO: servico Wi-Fi nao ficou pronto."
    );

    return;
  }

  // =========================
  // PROCURA SSID SALVO
  // =========================

  Serial.println();
  Serial.println(
    "Procurando configuracao Wi-Fi salva..."
  );

  startTime =
    millis();

  String savedSSID;

  while (
    savedSSID.length() == 0 &&
    millis() - startTime < 20000
  ) {

    savedSSID =
      WiFi.SSID();

    if (savedSSID.length() == 0) {

      Serial.print(".");
      delay(500);
    }
  }

  Serial.println();

  // =========================
  // NENHUM SSID ENCONTRADO
  // =========================

  if (savedSSID.length() == 0) {

    Serial.println();
    Serial.println(
      "ERRO: nenhuma rede Wi-Fi salva foi encontrada."
    );

    return;
  }

  Serial.print("SSID salvo: ");
  Serial.println(savedSSID);

  Serial.print("MAC Wi-Fi: ");

  // =========================
  // CONECTA
  // =========================

  Serial.println();
  Serial.println(
    "Conectando ao Wi-Fi salvo..."
  );

  WiFi.begin();

  startTime =
    millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - startTime < 20000
  ) {

    Serial.print(".");
    delay(500);
  }

  Serial.println();

  // =========================
  // CONECTADO
  // =========================

  if (
    WiFi.status() == WL_CONNECTED
  ) {

    Serial.println();
    Serial.println(
      "=== WI-FI CONECTADO ==="
    );

    Serial.print("IP: ");
    Serial.println(
      WiFi.localIP()
    );

    Serial.print("RSSI: ");
    Serial.print(
      WiFi.RSSI()
    );

    Serial.println(" dBm");

    Serial.print("MAC Wi-Fi: ");
    Serial.println(
      WiFi.STA.macAddress()
    );

  } else {

    Serial.println();
    Serial.println(
      "ERRO: nao foi possivel conectar ao Wi-Fi salvo."
    );
  }
}

// =========================
// TESTE DE INTERNET
// =========================

void testInternet() {

  Serial.println();
  Serial.println(
    "=== TESTE DE INTERNET ==="
  );

  HTTPClient http;

  Serial.println(
    "Fazendo requisicao..."
  );

  http.begin(
    "http://httpbin.org/get"
  );

  int httpCode =
    http.GET();

  Serial.print(
    "HTTP status: "
  );

  Serial.println(
    httpCode
  );

  if (httpCode > 0) {

    String response =
      http.getString();

    Serial.println(
      "Resposta:"
    );

    Serial.println(
      response
    );

  } else {

    Serial.print(
      "Erro HTTP: "
    );

    Serial.println(
      http.errorToString(httpCode)
    );
  }

  http.end();

  Serial.println();
  Serial.println(
    "=== FIM DO TESTE ==="
  );
}

// =========================
// SETUP
// =========================

void setup() {

  Serial.begin(115200);

  delay(3000);

  Serial.println();
  Serial.println(
    "================================"
  );
  Serial.println(
    "       QUADRO E-INK"
  );
  Serial.println(
    "      WIFI + BLE + MICROSD"
  );
  Serial.println(
    "================================"
  );

  bool sdOK =
    initSD();

  if (sdOK) {
    testSD();
  }

  pinMode(
    WIFI_CONFIG_BUTTON,
    INPUT_PULLUP
  );

  bool configureWiFi =
    digitalRead(WIFI_CONFIG_BUTTON) == LOW;

  WiFi.mode(WIFI_STA);

  WiFi.onEvent(
    SysProvEvent
  );

  if (configureWiFi) {

    Serial.println();
    Serial.println(
      "SW2 pressionado."
    );

    Serial.println(
      "Modo de configuracao Wi-Fi."
    );

    if (!initializeWiFiMac()) {
      Serial.println("Encerrando.");
      return;
    }

    // Primeiro disponibiliza o MAC
    // para o aplicativo.
    startDeviceBLE();

    Serial.println();
    Serial.println("Aguardando comando de provisioning...");

    while (!provisioningRequested) {
      delay(10);
    }

    Serial.println();
    Serial.println("Comando de provisioning recebido.");

    BLEDevice::stopAdvertising();
    Serial.println("Advertising do BLE de identificacao encerrado.");

    BLEDevice::deinit(false);
    Serial.println("BLE de identificacao encerrado.");

    delay(1000);

    startWiFiProvisioning();
  } else {

    Serial.println();
    Serial.println(
      "SW2 nao pressionado."
    );

    Serial.println(
      "Modo normal."
    );

    // No modo normal NÃO existe BLE
    // de configuracao.
    connectToSavedWiFi();
  }
}

// =========================
// LOOP
// =========================

void loop() {

  static bool internetTested = false;

  if (
    WiFi.status() == WL_CONNECTED &&
    !internetTested
  ) {

    internetTested = true;

    delay(1000);

    testInternet();
  }

  delay(100);
}